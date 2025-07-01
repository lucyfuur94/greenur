import { Handler } from '@netlify/functions'
import Busboy from 'busboy'
import sharp from 'sharp'
import { MongoClient } from 'mongodb'
import { GoogleGenerativeAI } from '@google/generative-ai'

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

interface PlantFromDB {
  _id: string;
  common_name: string;
  scientific_name: string;
  plant_type: string;
}

async function fetchDatabasePlants(): Promise<PlantFromDB[]> {
  let client: MongoClient | null = null;
  
  try {
    client = new MongoClient(MONGO_URI!);
    await client.connect();
    
    const db = client.db(DB_NAME);
    const collection = db.collection<PlantFromDB>('plant_basics');
    
    // Fetch all plants with only the required fields
    const plants = await collection
      .find({}, { projection: { common_name: 1, scientific_name: 1, plant_type: 1 } })
      .sort({ common_name: 1 })
      .toArray();
      
    console.log(`[analyze-plant] Fetched ${plants.length} plants from database`);
    return plants;
  } catch (error) {
    console.error('[analyze-plant] Error fetching plants from database:', error);
    return [];
  } finally {
    if (client) {
      await client.close();
    }
  }
}

async function processImage(buffer: Buffer): Promise<{ mime: string; data: string }> {
  try {
    // Optimize image processing for faster analysis
    const processedBuffer = await sharp(buffer)
      .jpeg({ quality: 70 }) // Reduce quality for smaller size
      .resize(300, 300, { // Smaller size for plant identification
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer();

    return {
      mime: 'image/jpeg',
      data: processedBuffer.toString('base64')
    };
  } catch (error) {
    console.error('Image processing failed:', error);
    throw new Error('Failed to process image');
  }
}

function extractJsonFromText(text: string): any {
  // Try to find JSON in markdown code blocks first
  const jsonBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1]);
    } catch (e) {
      console.log('Failed to parse JSON from code block');
    }
  }

  // Find the last valid JSON object in the text (in case there's explanation before it)
  const jsonMatches = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
  if (jsonMatches && jsonMatches.length > 0) {
    // Try parsing from the last match first (most likely to be the final answer)
    for (let i = jsonMatches.length - 1; i >= 0; i--) {
      try {
        const parsed = JSON.parse(jsonMatches[i]);
        if (parsed.plant || parsed.inDatabase !== undefined) {
          return parsed;
        }
      } catch (e) {
        console.log(`Failed to parse JSON match ${i}:`, jsonMatches[i]);
      }
    }
  }

  // Try to find any JSON directly in the text as fallback
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.log('Failed to parse direct JSON');
  }

  // If no valid JSON found, create a structured response from the text
  return {
    plant: "Can't be identified",
    inDatabase: false,
    error: "Could not parse plant details"
  };
}

export const handler: Handler = async (event, context) => {
  // Set a shorter timeout for the function
  context.callbackWaitsForEmptyEventLoop = false;
  
  // Set CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }
  
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[analyze-plant] Gemini API key is not configured');
    throw new Error('Gemini API key not found in environment variables (GEMINI_API_KEY)');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    console.log('[analyze-plant] Request headers:', JSON.stringify(event.headers));
    console.log('[analyze-plant] Request body type:', typeof event.body);
    console.log('[analyze-plant] Request isBase64Encoded:', event.isBase64Encoded);
    
    let imageBuffer: Buffer | undefined;
    
    if (!event.body) {
      console.error('[analyze-plant] No image data received');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No image data received' })
      };
    }

    if (event.headers['content-type']?.includes('multipart/form-data')) {
      console.log('[analyze-plant] Processing multipart form data');
      const busboy = Busboy({ headers: event.headers });
      const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
      console.log('[analyze-plant] Request body size:', bodyBuffer.length, 'bytes');

      await new Promise((resolve, reject) => {
        busboy.on('file', (fieldname, file, info) => {
          console.log('[analyze-plant] Processing file:', fieldname, info);
          if (fieldname !== 'image') {
            console.log('[analyze-plant] Skipping non-image field:', fieldname);
            file.resume();
            return;
          }

          const chunks: Buffer[] = [];
          file.on('data', (chunk) => chunks.push(chunk));
          file.on('end', () => {
            console.log('[analyze-plant] File upload complete, size:', chunks.reduce((acc, chunk) => acc + chunk.length, 0), 'bytes');
            imageBuffer = Buffer.concat(chunks);
            resolve(true);
          });
        });

        busboy.on('error', (error) => {
          console.error('[analyze-plant] Busboy error:', error);
          reject(error);
        });
        
        busboy.on('finish', () => {
          console.log('[analyze-plant] Busboy finished');
          if (!imageBuffer) {
            console.error('[analyze-plant] No image field found in form data');
            reject(new Error('No image field found in form data'));
          } else {
            resolve(true);
          }
        });

        busboy.end(bodyBuffer);
      });
    } else {
      console.log('[analyze-plant] Processing raw body data');
      imageBuffer = Buffer.from(event.body, 'base64');
    }

    if (!imageBuffer) {
      console.error('[analyze-plant] No image data found in request');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No image data found in request' })
      };
    }

    console.log('[analyze-plant] Processing image, size:', imageBuffer.length, 'bytes');
    const { mime, data } = await processImage(imageBuffer);
    console.log('[analyze-plant] Image processed successfully');

    // Fetch plants from database
    console.log('[analyze-plant] Fetching plants from database...');
    const databasePlants = await fetchDatabasePlants();
    
    if (databasePlants.length === 0) {
      console.error('[analyze-plant] No plants found in database');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'No plants available in database' })
      };
    }

    // Create concise plant list for Gemini prompt (common names only)
    const plantNames = databasePlants.map(plant => plant.common_name).join(', ');
    console.log('[analyze-plant] Plant names sent to Gemini:', plantNames.length > 200 ? `${plantNames.substring(0, 200)}...` : plantNames);

    // Call Gemini API
    console.log('[analyze-plant] Calling Gemini API with model: gemini-1.5-flash')
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `Plant list: ${plantNames}

Return ONLY JSON, no explanation:

If matches list: {"plant": "EXACT name from list", "inDatabase": true}
If not in list: {"plant": "name", "scientificName": "name", "plantType": "type", "inDatabase": false}`
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: data
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2000, // Sufficient for JSON response
          topP: 0.8,
          topK: 40
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE"
          }
        ]
      })
    });

    if (!geminiResponse.ok) {
      const error = await geminiResponse.json().catch(() => ({}))
      console.error('[analyze-plant] Gemini API error:', error)
      console.error('[analyze-plant] Response status:', geminiResponse.status)
      console.error('[analyze-plant] Response headers:', Object.fromEntries(geminiResponse.headers.entries()))
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${JSON.stringify(error)}`)
    }

    const geminiData = await geminiResponse.json()
    console.log('[analyze-plant] Gemini response data:', JSON.stringify(geminiData, null, 2))
    
    // Extract text from Gemini response
    const analysisText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!analysisText) {
      console.error('[analyze-plant] No response text from Gemini')
      console.error('[analyze-plant] Full response structure:', JSON.stringify(geminiData, null, 2))
      
      // Check if there's an error in the response
      if (geminiData?.error) {
        throw new Error(`Gemini API error: ${geminiData.error.message || geminiData.error}`)
      }
      
      // Check if candidates exist but are blocked
      if (geminiData?.candidates?.[0]?.finishReason) {
        const finishReason = geminiData.candidates[0].finishReason
        console.error('[analyze-plant] Gemini finish reason:', finishReason)
        
        // Handle different finish reasons
        if (finishReason === 'MAX_TOKENS') {
          throw new Error('Response too long - trying with higher token limit')
        } else if (finishReason === 'SAFETY') {
          throw new Error('Content blocked by safety filters')
        } else if (finishReason === 'STOP' && !analysisText) {
          // Gemini finished but returned empty response - likely due to prompt issues
          console.log('[analyze-plant] Gemini returned empty response with STOP - using fallback');
          const geminiResult = {
            plant: "Can't be identified",
            inDatabase: false,
            error: "Empty response from Gemini"
          };
          
          // Skip to fallback processing
          const analysis = {
            commonName: "Can't be identified",
            scientificName: "Species unknown", 
            plantType: "Unknown",
            inDatabase: false
          };
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ analysis })
          };
        } else {
          throw new Error(`Gemini response blocked: ${finishReason}`)
        }
      }
      
      throw new Error('No response from Gemini API')
    }

    console.log('[analyze-plant] Raw Gemini response text:', analysisText)

    // Extract and parse JSON from the response
    const geminiResult = extractJsonFromText(analysisText);
    console.log('[analyze-plant] Parsed Gemini result:', geminiResult);

    let analysis;
    
    if (geminiResult.inDatabase === true && geminiResult.plant) {
      // Plant was found in our database - fetch full details using exact database values
      const foundPlant = databasePlants.find(plant => 
        plant.common_name.toLowerCase().trim() === geminiResult.plant.toLowerCase().trim()
      );
      
      if (foundPlant) {
        // Always use the exact database values, never Gemini's response
        analysis = {
          commonName: foundPlant.common_name,
          scientificName: foundPlant.scientific_name,
          plantType: foundPlant.plant_type,
          inDatabase: true,
          catalogId: foundPlant._id
        };
        console.log('[analyze-plant] Found exact plant in database:', {
          geminiReturned: geminiResult.plant,
          databaseValues: {
            commonName: foundPlant.common_name,
            scientificName: foundPlant.scientific_name,
            plantType: foundPlant.plant_type,
            catalogId: foundPlant._id
          }
        });
      } else {
        // Gemini said it's in database but we can't find exact match - try fuzzy matching
        const fuzzyMatch = databasePlants.find(plant => 
          plant.common_name.toLowerCase().includes(geminiResult.plant.toLowerCase()) ||
          geminiResult.plant.toLowerCase().includes(plant.common_name.toLowerCase())
        );
        
        if (fuzzyMatch) {
          analysis = {
            commonName: fuzzyMatch.common_name,
            scientificName: fuzzyMatch.scientific_name,
            plantType: fuzzyMatch.plant_type,
            inDatabase: true,
            catalogId: fuzzyMatch._id
          };
          console.log('[analyze-plant] Found fuzzy match in database:', {
            geminiReturned: geminiResult.plant,
            databaseMatch: fuzzyMatch.common_name,
            catalogId: fuzzyMatch._id
          });
        } else {
          // Really can't find it - treat as not in database
          analysis = {
            commonName: "Can't be identified, not in our database",
            scientificName: "Species unknown",
            plantType: "Unknown",
            inDatabase: false
          };
          console.log('[analyze-plant] Gemini claimed plant in database but no match found:', geminiResult.plant);
        }
      }
    } else if (geminiResult.inDatabase === false && geminiResult.plant) {
      // Plant not in our database but Gemini provided details
      analysis = {
        commonName: geminiResult.plant,
        scientificName: geminiResult.scientificName || "Species unknown",
        plantType: geminiResult.plantType || "Unknown",
        inDatabase: false
      };
      console.log('[analyze-plant] Plant not in database, Gemini provided details:', analysis);
    } else {
      // Fallback - could not identify at all
      analysis = {
        commonName: "Can't be identified",
        scientificName: "Species unknown",
        plantType: "Unknown",
        inDatabase: false
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ analysis })
    };
  } catch (error) {
    console.error('Error processing image:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to process image',
        details: error instanceof Error ? error.stack : undefined
      })
    };
  }
} 