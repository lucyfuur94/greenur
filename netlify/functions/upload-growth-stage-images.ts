import { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { MongoClient, ServerApiVersion } from 'mongodb';
import busboy from 'busboy';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { tmpdir } from 'os';

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGODB_DB || 'master';

// Initialize Firebase Admin with service account
if (!admin.apps.length) {
  try {
    const serviceAccount = require('./utils/serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'aegisg-494e1.firebasestorage.app'
    });
    console.log('[upload-growth-stage-images] Firebase Admin initialized successfully');
  } catch (error) {
    console.error('[upload-growth-stage-images] Error initializing Firebase Admin:', error);
    throw error;
  }
}

const bucket = getStorage().bucket();

// Growth stage interface
interface GrowthStageImage {
  plantType: string;
  stageName: string;
  stageDescription: string;
  imageUrl: string;
  firebasePath: string;
  stageOrder: number;
  uploadedAt: Date;
  uploadedBy?: string;
  metadata: {
    originalFileName: string;
    fileSize: number;
    contentType: string;
  };
}

// Define growth stages for different plants
const PLANT_GROWTH_STAGES = {
  tomato: [
    { name: 'germination', description: 'Seed germination and early sprouting', order: 1 },
    { name: 'seedling', description: 'Young plant with first true leaves', order: 2 },
    { name: 'vegetative_growth', description: 'Rapid growth and leaf development', order: 3 },
    { name: 'flowering', description: 'Flower buds and blooming stage', order: 4 },
    { name: 'fruiting', description: 'Fruit formation and development', order: 5 },
    { name: 'ripening', description: 'Fruit maturation and ripening', order: 6 }
  ]
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('[upload-growth-stage-images] Starting upload process');

    // Parse form data
    const parseFormData = () => {
      return new Promise<{ fields: Record<string, string>; filePath: string; originalName: string; fileSize: number }>((resolve, reject) => {
        const fields: Record<string, string> = {};
        let filePath = '';
        let originalName = '';
        let fileSize = 0;
        let fileWriteStream: fs.WriteStream | null = null;

        const bb = busboy({ 
          headers: event.headers as Record<string, string>,
          limits: {
            fileSize: 10 * 1024 * 1024, // 10MB limit for high quality images
            files: 1
          }
        });

        bb.on('field', (fieldname: string, value: string) => {
          fields[fieldname] = value;
        });

        bb.on('file', (fieldname: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
          const tmpPath = path.join(tmpdir(), `growth_stage_${Date.now()}_${info.filename}`);
          filePath = tmpPath;
          originalName = info.filename;

          fileWriteStream = fs.createWriteStream(tmpPath);
          file.pipe(fileWriteStream);

          file.on('data', (chunk) => {
            fileSize += chunk.length;
          });

          file.on('limit', () => {
            if (fileWriteStream) {
              fileWriteStream.end();
              fs.unlinkSync(tmpPath);
            }
            reject(new Error('File size limit exceeded (10MB)'));
          });
        });

        bb.on('finish', () => {
          if (fileWriteStream) {
            fileWriteStream.end();
          }
          resolve({ fields, filePath, originalName, fileSize });
        });

        bb.on('error', (error: Error) => {
          if (fileWriteStream) {
            fileWriteStream.end();
            if (filePath && fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
          reject(error);
        });

        if (event.body) {
          const stream = new Readable({
            read() {
              this.push(Buffer.from(event.body as string, event.isBase64Encoded ? 'base64' : 'utf8'));
              this.push(null);
            }
          });
          stream.pipe(bb);
        } else {
          reject(new Error('No request body'));
        }
      });
    };

    const { fields, filePath, originalName, fileSize } = await parseFormData();
    
    const { plantType, stageName, uploadedBy } = fields;

    if (!filePath || !plantType || !stageName) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing required fields: file, plantType, or stageName' })
      };
    }

    // Validate plant type and stage
    const plantStages = PLANT_GROWTH_STAGES[plantType.toLowerCase() as keyof typeof PLANT_GROWTH_STAGES];
    if (!plantStages) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Unsupported plant type: ${plantType}` })
      };
    }

    const stageInfo = plantStages.find(stage => stage.name === stageName.toLowerCase());
    if (!stageInfo) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: `Invalid stage name: ${stageName}` })
      };
    }

    // Create Firebase path
    const timestamp = Date.now();
    const sanitizedFileName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const firebasePath = `growth-stages/${plantType.toLowerCase()}/${stageName.toLowerCase()}/${timestamp}_${sanitizedFileName}`;

    console.log('[upload-growth-stage-images] Uploading to Firebase:', firebasePath);

    // Upload to Firebase Storage
    await bucket.upload(filePath, {
      destination: firebasePath,
      metadata: {
        contentType: fields.contentType || 'image/jpeg',
        metadata: {
          plantType: plantType.toLowerCase(),
          stageName: stageName.toLowerCase(),
          stageOrder: stageInfo.order.toString(),
          uploadedBy: uploadedBy || 'system',
          originalName: originalName,
          timestamp: timestamp.toString(),
        },
      },
    });

    // Get the download URL
    const [url] = await bucket.file(firebasePath).getSignedUrl({
      action: 'read',
      expires: '03-01-2500', // Long expiration
    });

    console.log('[upload-growth-stage-images] File uploaded, got URL:', url);

    // Store metadata in MongoDB
    const growthStageData: GrowthStageImage = {
      plantType: plantType.toLowerCase(),
      stageName: stageName.toLowerCase(),
      stageDescription: stageInfo.description,
      imageUrl: url,
      firebasePath: firebasePath,
      stageOrder: stageInfo.order,
      uploadedAt: new Date(),
      uploadedBy: uploadedBy || 'system',
      metadata: {
        originalFileName: originalName,
        fileSize: fileSize,
        contentType: fields.contentType || 'image/jpeg'
      }
    };

    // Connect to MongoDB and save
    const client = new MongoClient(MONGO_URI!, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });

    try {
      await client.connect();
      const db = client.db(DB_NAME);
      const collection = db.collection('plant_growth_stages');

      // Create index for efficient querying
      await collection.createIndex({ plantType: 1, stageName: 1, stageOrder: 1 });
      
      const result = await collection.insertOne(growthStageData);
      console.log('[upload-growth-stage-images] Saved to MongoDB with ID:', result.insertedId);

    } finally {
      await client.close();
    }

    // Clean up temporary file
    fs.unlinkSync(filePath);
    console.log('[upload-growth-stage-images] Temporary file cleaned up');

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: {
          id: growthStageData,
          imageUrl: url,
          firebasePath: firebasePath,
          plantType: plantType.toLowerCase(),
          stageName: stageName.toLowerCase(),
          stageOrder: stageInfo.order
        }
      })
    };

  } catch (error) {
    console.error('[upload-growth-stage-images] Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler }; 