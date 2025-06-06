import { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import * as admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import busboy from 'busboy';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

// Initialize Firebase Admin with service account - only initialize once
let bucket: any;
if (!admin.apps.length) {
  try {
    const serviceAccount = require('./utils/serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'aegisg-494e1.firebasestorage.app'
    });
    bucket = getStorage().bucket();
  } catch (error) {
    console.error('[upload-image] Error initializing Firebase Admin:', error);
    throw error;
  }
} else {
  bucket = getStorage().bucket();
}

const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
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
    }

    // Parse the multipart form data
    const parseFormData = () => {
      return new Promise<{ fields: Record<string, string>; filePath: string }>((resolve, reject) => {
        const fields: Record<string, string> = {};
        let filePath = '';
        let fileWriteStream: fs.WriteStream | null = null;

        // Create a busboy instance with optimized settings
        const bb = busboy({ 
          headers: event.headers as Record<string, string>,
          limits: {
            fileSize: 5 * 1024 * 1024, // 5MB limit
            files: 1 // Only process one file
          }
        });

        // Handle fields
        bb.on('field', (fieldname: string, value: string) => {
          fields[fieldname] = value;
        });

        // Handle file
        bb.on('file', (fieldname: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
          const tmpPath = path.join(tmpdir, `${Date.now()}_${info.filename}`);
          filePath = tmpPath;

          fileWriteStream = fs.createWriteStream(tmpPath);
          file.pipe(fileWriteStream);

          file.on('limit', () => {
            if (fileWriteStream) {
              fileWriteStream.end();
              fs.unlinkSync(tmpPath);
            }
            reject(new Error('File size limit exceeded (5MB)'));
          });
        });

        // Handle finish
        bb.on('finish', () => {
          if (fileWriteStream) {
            fileWriteStream.end();
          }
          resolve({ fields, filePath });
        });

        // Handle error
        bb.on('error', (error: Error) => {
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
    const { fields, filePath } = await parseFormData();

    // Get the user ID
    const userId = fields.userId;

    if (!filePath || !userId) {
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
    const fullPath = `plants/${userId}/${filename}`;

    // Upload to Firebase Storage with optimized settings
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
      resumable: false // Disable resumable uploads for faster small file uploads
    });

    // Clean up the temporary file
    fs.unlinkSync(filePath);

    // Get the download URL
    const [url] = await bucket.file(fullPath).getSignedUrl({
      action: 'read',
      expires: '03-01-2500', // Long expiration
    });

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
    console.error('[upload-image] Error uploading image:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Failed to upload image',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
};

export { handler }; 