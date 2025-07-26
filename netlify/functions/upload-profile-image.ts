import { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import busboy from 'busboy';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

// Initialize Firebase Admin with service account
if (!admin.apps.length) {
  try {
    let serviceAccount;
    
    // Try to load from environment variable first
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        console.log('[upload-profile-image] Loaded service account from environment variable');
      } catch (parseError) {
        console.error('[upload-profile-image] Error parsing FIREBASE_SERVICE_ACCOUNT_JSON:', parseError);
      }
    }
    
    // If no environment variable, try loading from local file
    if (!serviceAccount) {
      try {
        serviceAccount = require('./utils/serviceAccountKey.json');
        console.log('[upload-profile-image] Loaded service account from local file');
      } catch (fileError) {
        console.error('[upload-profile-image] Error loading local service account:', fileError);
        throw fileError;
      }
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET
    });
    console.log('[upload-profile-image] Firebase Admin initialized successfully');
  } catch (error) {
    console.error('[upload-profile-image] Error initializing Firebase Admin:', error);
    throw error;
  }
}

const bucket = getStorage().bucket();

const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  console.log('[upload-profile-image] Starting function with event:', {
    httpMethod: event.httpMethod,
    headers: event.headers,
    isBase64Encoded: event.isBase64Encoded,
    bodyLength: event.body?.length
  });

  // Enable CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    // Create a temporary directory for file uploads
    const tmpdir = '/tmp';
    if (!fs.existsSync(tmpdir)) {
      fs.mkdirSync(tmpdir);
      console.log('[upload-profile-image] Created temporary directory:', tmpdir);
    }

    // Parse the multipart form data
    const parseFormData = () => {
      return new Promise<{ fields: Record<string, string>; filePath: string }>((resolve, reject) => {
        const fields: Record<string, string> = {};
        let filePath = '';
        let fileWriteStream: fs.WriteStream | null = null;

        // Create a busboy instance
        const bb = busboy({ 
          headers: event.headers as Record<string, string>,
          limits: {
            fileSize: 2 * 1024 * 1024 // 2MB limit for profile images
          }
        });

        // Handle fields
        bb.on('field', (fieldname: string, value: string) => {
          console.log('[upload-profile-image] Field:', fieldname, value);
          fields[fieldname] = value;
        });

        // Handle file
        bb.on('file', (fieldname: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
          console.log('[upload-profile-image] File:', {
            fieldname,
            filename: info.filename,
            encoding: info.encoding,
            mimeType: info.mimeType
          });

          const tmpPath = path.join(tmpdir, `${Date.now()}_${info.filename}`);
          filePath = tmpPath;

          fileWriteStream = fs.createWriteStream(tmpPath);
          file.pipe(fileWriteStream);

          file.on('end', () => {
            console.log('[upload-profile-image] File written to:', tmpPath);
          });

          file.on('limit', () => {
            if (fileWriteStream) {
              fileWriteStream.end();
              fs.unlinkSync(tmpPath);
            }
            reject(new Error('File size limit exceeded (2MB)'));
          });
        });

        // Handle finish
        bb.on('finish', () => {
          console.log('[upload-profile-image] Form parsing complete');
          if (fileWriteStream) {
            fileWriteStream.end();
          }
          resolve({ fields, filePath });
        });

        // Handle error
        bb.on('error', (error: Error) => {
          console.error('[upload-profile-image] Busboy error:', error);
          if (fileWriteStream) {
            fileWriteStream.end();
            if (filePath && fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          }
          reject(error);
        });

        // Create a readable stream from the request body
        if (event.body) {
          const stream = new Readable({
            read() {
              this.push(Buffer.from(event.body as string, event.isBase64Encoded ? 'base64' : 'utf8'));
              this.push(null);
            }
          });

          // Pipe the stream to busboy
          stream.pipe(bb);
        } else {
          reject(new Error('No request body'));
        }
      });
    };

    // Parse the form data
    console.log('[upload-profile-image] Starting form parse');
    const { fields, filePath } = await parseFormData();
    console.log('[upload-profile-image] Form parsed:', { fields, filePath });

    // Get the user ID
    const userId = fields.userId;

    if (!filePath || !userId) {
      console.error('[upload-profile-image] Missing file or userId:', { filePath: !!filePath, userId: !!userId });
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing file or userId' }),
      };
    }

    // Create a unique filename
    const timestamp = Date.now();
    const originalName = path.basename(filePath);
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${sanitizedName}`;
    const fullPath = `profiles/${userId}/profile-image`;

    console.log('[upload-profile-image] Uploading to Firebase:', { fullPath });

    // Upload to Firebase Storage
    await bucket.upload(filePath, {
      destination: fullPath,
      metadata: {
        contentType: fields.contentType || 'image/jpeg',
        metadata: {
          uploadedBy: userId,
          originalName: originalName,
          timestamp: timestamp.toString(),
        },
      },
    });

    console.log('[upload-profile-image] File uploaded to Firebase');

    // Clean up the temporary file
    fs.unlinkSync(filePath);
    console.log('[upload-profile-image] Temporary file cleaned up');

    // Get the download URL
    const [url] = await bucket.file(fullPath).getSignedUrl({
      action: 'read',
      expires: '03-01-2500', // Long expiration
    });

    console.log('[upload-profile-image] Got signed URL:', url);

    // Update user profile in MongoDB
    try {
      const { MongoClient } = require('mongodb');
      const MONGO_URI = process.env.MONGO_URI;
      const DB_NAME = process.env.MONGODB_DB || 'master';
      
      if (!MONGO_URI) {
        throw new Error('MONGO_URI environment variable is not set');
      }
      
      const client = new MongoClient(MONGO_URI);
      await client.connect();
      
      const db = client.db(DB_NAME);
      const usersCollection = db.collection('users');
      
      await usersCollection.updateOne(
        { uid: userId },
        { 
          $set: { 
            photoURL: url,
            updatedAt: new Date().toISOString()
          }
        },
        { upsert: true }
      );
      
      await client.close();
      console.log('[upload-profile-image] Updated user profile in MongoDB');
    } catch (dbError) {
      console.error('[upload-profile-image] Error updating MongoDB:', dbError);
      // Continue even if MongoDB update fails
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        success: true, 
        url,
        path: fullPath
      }),
    };
  } catch (error) {
    console.error('[upload-profile-image] Error uploading image:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Failed to upload profile image',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
    };
  }
};

export { handler }; 