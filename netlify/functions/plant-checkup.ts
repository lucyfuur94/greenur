import { Handler } from '@netlify/functions'
import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'
import OpenAI from 'openai'
import axios from 'axios'
import sharp from 'sharp'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY
})

interface CheckupResult {
  stage: string;
  healthAssessment: {
    overall: string;
    details: string[];
  };
  concerns: { issue: string; severity: string }[];
  carePlan: {
    watering: string;
    light: string;
    fertilization: string;
    maintenance: string[];
  };
  todoItems: string[];
  nextCheckupDate: string;
}

interface PlantCheckup {
  plantId: string;
  userId: string;
  date: string;
  imageUrl: string;
  status: 'processing' | 'complete' | 'error';
  checkupResult?: CheckupResult;
  completedTodos?: string[];
  growthAnalysis?: {
    rate: string;
    changes: string[];
  };
  error?: string;
  progress?: {
    stage: string;
    percent: number;
    message?: string;
  };
}

interface ProcessingResponse {
  status: 'processing' | 'complete' | 'error';
  checkupId?: string;
  message: string;
  error?: string;
  progress?: {
    stage: string;
    percent: number;
    message?: string;
  };
}

interface ProcessingPlantCheckup extends Omit<PlantCheckup, 'checkupResult'> {
  status: 'processing' | 'complete' | 'error';
  checkupResult?: CheckupResult | null;
  error?: string;
}

async function getImageAsBase64(url: string): Promise<string> {
  try {
    const HEAD = await axios.head(url);
    if (HEAD.headers['content-length'] > 5_000_000) {
      throw new Error('Image exceeds 5MB limit');
    }

    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const imageBuffer = Buffer.from(response.data);
    
    // Optimize image processing for faster analysis
    const processedBuffer = await sharp(imageBuffer)
      .resize(384, 384, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: 70,
        progressive: true,
        optimizeScans: true,
        mozjpeg: true
      })
      .toBuffer();

    // Log the size of the processed image
    const processedImage = sharp(processedBuffer);
    const metadata = await processedImage.metadata();
    console.log('Processed image size:', {
      width: metadata.width,
      height: metadata.height,
      sizeInKB: Math.round(processedBuffer.length / 1024)
    });

    return processedBuffer.toString('base64');
  } catch (error) {
    console.error('Error processing image:', error);
    throw new Error('Failed to process image');
  }
}

const TIMEOUT_MS = 25000; // 25 seconds, leaving 5 seconds for cleanup

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
} as const;

// Add helper function to get next checkup date based on user preferences
async function getNextCheckupDate(userId: string, db: any): Promise<string> {
  try {
    // Get user preferences
    const user = await db.collection('users').findOne({ uid: userId });
    const preferences = user?.preferences || {
      preferredCheckupDays: ['sunday'],
      checkupFrequency: 2
    };

    const today = new Date();
    let nextDate = new Date(today);
    const preferredDays = preferences.preferredCheckupDays.map(day => 
      day === 'saturday' ? 6 : 0
    );

    // Add weeks based on frequency
    nextDate.setDate(today.getDate() + (7 * preferences.checkupFrequency));

    // Find the next preferred day
    while (!preferredDays.includes(nextDate.getDay())) {
      nextDate.setDate(nextDate.getDate() + 1);
    }

    return nextDate.toISOString().split('T')[0];
  } catch (error) {
    console.error('Error getting next checkup date:', error);
    // Fallback to 2 weeks from now on Sunday
    const fallbackDate = new Date();
    fallbackDate.setDate(fallbackDate.getDate() + 14);
    while (fallbackDate.getDay() !== 0) {
      fallbackDate.setDate(fallbackDate.getDate() + 1);
    }
    return fallbackDate.toISOString().split('T')[0];
  }
}

export const handler: Handler = async (event, context) => {
  // Disable waiting for empty event loop to prevent timeouts
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  const mainAbortController = new AbortController();
  const backgroundAbortController = new AbortController();
  let timeoutId: NodeJS.Timeout | null = null;
  let client: MongoClient | null = null;

  try {
    console.time('Total Function Execution');

    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: corsHeaders,
        body: ''
      };
    }

    if (!event.httpMethod || !['POST', 'GET', 'DELETE'].includes(event.httpMethod)) {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Method not allowed' })
      }
    }

    client = await MongoClient.connect(MONGO_URI!, {
      serverSelectionTimeoutMS: 5000 // 5 second timeout for MongoDB connection
    });
    const db = client.db(DB_NAME);
    const checkupsCollection = db.collection<PlantCheckup>('plant_checkups');

    // DELETE - Remove a checkup
    if (event.httpMethod === 'DELETE') {
      const { id } = event.queryStringParameters || {};
      
      if (!id) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Checkup ID is required' })
        }
      }

      const result = await checkupsCollection.deleteOne({ 
        _id: new ObjectId(id)
      });

      if (result.deletedCount === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Checkup not found' })
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Checkup deleted successfully'
        })
      }
    }

    // GET - Fetch checkups for a plant or get progress of a specific checkup
    if (event.httpMethod === 'GET') {
      const { plantId, checkupId } = event.queryStringParameters || {};
      
      if (!plantId && !checkupId) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Either Plant ID or Checkup ID is required' })
        }
      }

      if (checkupId) {
        // Fetch specific checkup for progress
        const checkup = await checkupsCollection.findOne({ _id: new ObjectId(checkupId) });
        
        if (!checkup) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Checkup not found' })
          }
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            status: checkup.status,
            message: checkup.status === 'complete' ? 'Checkup completed' : 'Checkup in progress',
            error: checkup.error,
            progress: checkup.progress,
            checkup
          })
        }
      }

      // Fetch all checkups for a plant
      const checkups = await checkupsCollection
        .find({ plantId })
        .sort({ date: -1 })
        .toArray();

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ checkups })
      }
    }

    // POST - Create a new checkup
    if (event.httpMethod === 'POST') {
      console.time('Request Parsing');
      const { plantId, userId, imageUrl, previousImageUrl } = JSON.parse(event.body || '{}');
      console.timeEnd('Request Parsing');

      if (!plantId || !userId || !imageUrl) {
        if (client) await client.close();
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Missing required fields' })
        };
      }

      // Create a temporary document to track progress
      const tempDoc: ProcessingPlantCheckup = {
        plantId,
        userId,
        date: new Date().toISOString(),
        imageUrl,
        status: 'processing',
        checkupResult: null,
        completedTodos: []
      };

      const insertResult = await checkupsCollection.insertOne(tempDoc as any);
      const checkupId = insertResult.insertedId.toString();

      // Send immediate response
      const response = {
        statusCode: 202,
        headers: corsHeaders,
        body: JSON.stringify({
          status: 'processing',
          checkupId,
          message: 'Plant checkup started. Please wait for completion.'
        } as ProcessingResponse)
      };

      // Set timeout for the background processing
      timeoutId = setTimeout(() => {
        backgroundAbortController.abort();
      }, TIMEOUT_MS);

      // Continue processing in background
      (async () => {
        try {
          // Update progress - Initializing
          await checkupsCollection.updateOne(
            { _id: new ObjectId(checkupId) },
            { 
              $set: {
                status: 'processing',
                progress: {
                  stage: 'INITIALIZING',
                  percent: 0,
                  message: 'Starting analysis...'
                }
              }
            }
          );

          console.time('Image Processing');
          let imageBase64: string;
          let previousImageBase64: string | null = null;

          // Update progress - Image Processing
          await checkupsCollection.updateOne(
            { _id: new ObjectId(checkupId) },
            { 
              $set: {
                progress: {
                  stage: 'IMAGE_PROCESSING',
                  percent: 20,
                  message: 'Processing and optimizing images...'
                }
              }
            }
          );

          // Process current image with timeout
          const processCurrentImage = async () => {
            try {
              imageBase64 = await getImageAsBase64(imageUrl);
              return imageBase64;
            } catch (err) {
              console.error('Failed to process current image:', err);
              throw new Error('Failed to process plant image');
            }
          };

          // Process previous image with timeout if exists
          const processPreviousImage = async () => {
            if (!previousImageUrl?.trim()) return null;
            try {
              return await getImageAsBase64(previousImageUrl);
            } catch (err) {
              console.warn('Failed to process previous image:', err);
              return null;
            }
          };

          // Run image processing with timeouts
          const [currentImage, prevImage] = await Promise.all([
            processCurrentImage(),
            previousImageUrl ? processPreviousImage() : Promise.resolve(null)
          ]);

          imageBase64 = currentImage as string;
          previousImageBase64 = prevImage as string | null;

          console.timeEnd('Image Processing');

          // Update progress - Plant Analysis
          await checkupsCollection.updateOne(
            { _id: new ObjectId(checkupId) },
            { 
              $set: {
                progress: {
                  stage: 'PLANT_ANALYSIS',
                  percent: 40,
                  message: 'Analyzing plant characteristics...'
                }
              }
            }
          );

          // Inside the background processing try block, update the messages array:
          const nextCheckupDate = await getNextCheckupDate(userId, db);
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

          const messages = [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this plant image and provide ONLY valid JSON in this format. Today's date is ${today}. The next checkup date should be ${nextCheckupDate}.

{
  "stage": "Current growth stage",
  "healthAssessment": {
    "overall": "Overall health",
    "details": ["point 1", "point 2"]
  },
  "concerns": [{"issue": "...", "severity": "high/medium/low"}],
  "carePlan": {
    "watering": "...",
    "light": "...", 
    "fertilization": "...",
    "maintenance": ["task 1", "task 2"]
  },
  "todoItems": ["action 1", "action 2"],
  "nextCheckupDate": "${nextCheckupDate}"
}${previousImageBase64 ? `\n\n7. Growth Analysis (comparing with previous image):\n   - Growth rate (e.g., slow, moderate, rapid)\n   - Specific changes observed\n   - Areas of improvement\n   - New concerns (if any)\n   - Effectiveness of previous care plan` : ''}`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                    detail: "high"
                  }
                }
              ]
            }
          ];

          if (previousImageBase64) {
            messages[0].content.push({
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${previousImageBase64}`,
                detail: "high"
              }
            });
          }

          // Update progress - Health Assessment
          await checkupsCollection.updateOne(
            { _id: new ObjectId(checkupId) },
            { 
              $set: {
                progress: {
                  stage: 'HEALTH_ASSESSMENT',
                  percent: 60,
                  message: 'Evaluating plant health...'
                }
              }
            }
          );

          // Make OpenAI request with the background abort controller
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages as any,
            max_tokens: 600,
            temperature: 0.3,
            response_format: { type: "json_object" }
          }, { signal: backgroundAbortController.signal });

          if (timeoutId) clearTimeout(timeoutId);

          if (!response || typeof response !== 'object' || !('choices' in response)) {
            throw new Error('Invalid response from OpenAI');
          }

          const content = response.choices?.[0]?.message?.content;
          if (!content || typeof content !== 'string') {
            throw new Error('Invalid content in OpenAI response');
          }

          const analysis = JSON.parse(content);

          const checkupResult: CheckupResult = {
            stage: analysis.stage || 'Unknown',
            healthAssessment: {
              overall: analysis.healthAssessment?.overall || 'Unknown',
              details: analysis.healthAssessment?.details || []
            },
            concerns: analysis.concerns || [],
            carePlan: {
              watering: analysis.carePlan?.watering || '',
              light: analysis.carePlan?.light || '',
              fertilization: analysis.carePlan?.fertilization || '',
              maintenance: analysis.carePlan?.maintenance || []
            },
            todoItems: analysis.todoItems || [],
            nextCheckupDate: analysis.nextCheckupDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          };

          // Initialize action items from todo items
          const actionItems = checkupResult.todoItems.map((item, index) => ({
            id: new ObjectId().toString(),
            text: item,
            completed: false,
            comments: []
          }));

          // Update progress - Report Generation
          await checkupsCollection.updateOne(
            { _id: new ObjectId(checkupId) },
            { 
              $set: {
                status: 'complete',
                checkupResult,
                actionItems,
                progress: {
                  stage: 'COMPLETE',
                  percent: 100,
                  message: 'Analysis complete'
                },
                ...(previousImageBase64 && {
                  growthAnalysis: {
                    rate: analysis.growthAnalysis?.rate || 'Unknown',
                    changes: analysis.growthAnalysis?.changes || []
                  }
                })
              }
            }
          );

        } catch (error) {
          console.error('Error in background processing:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const isTimeout = errorMessage.includes('abort') || errorMessage.includes('timeout');
          
          await checkupsCollection.updateOne(
            { _id: new ObjectId(checkupId) },
            { 
              $set: {
                status: 'error',
                error: isTimeout ? 'Analysis timed out' : errorMessage,
                progress: {
                  stage: 'ERROR',
                  percent: 0,
                  message: isTimeout ? 'Analysis took too long and was terminated' : errorMessage
                }
              }
            }
          );
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
          if (client) {
            await client.close().catch(console.error);
          }
        }
      })();

      return response;
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Invalid request' })
    }
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    console.timeEnd('Total Function Execution');
    console.error('Error handling plant checkup:', error);
    return {
      statusCode: error.name === 'AbortError' ? 504 : 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof Error ? error.stack : undefined
      })
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    // Only close the connection here for non-POST requests
    if (client && event.httpMethod !== 'POST') {
      await client.close().catch(console.error);
    }
    mainAbortController.abort();
  }
}; 