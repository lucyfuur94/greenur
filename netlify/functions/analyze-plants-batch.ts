import { Handler } from '@netlify/functions';
import busboy from 'busboy';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import OpenAI from 'openai';

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY
});

// Create a temporary directory for file uploads
const tmpdir = os.tmpdir();

// Process image with sharp
async function processImage(buffer: Buffer): Promise<{ mime: string; data: string }> {
  try {
    // Optimize image processing for faster analysis - same as in analyze-plant.ts
    const sharp = require('sharp');
    
    // Get image metadata to determine format
    const metadata = await sharp(buffer).metadata();
    console.log(`[analyze-plants-batch] Image format: ${metadata.format}, size: ${buffer.length} bytes`);
    
    // Process the image - reduce size even more for batch processing
    const processedBuffer = await sharp(buffer)
      .jpeg({ quality: 65 }) // Reduce quality further for batch processing
      .resize(250, 250, { // Smaller size for batch processing
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer();

    return {
      mime: 'image/jpeg',
      data: processedBuffer.toString('base64')
    };
  } catch (error) {
    console.error('[analyze-plants-batch] Image processing failed:', error);
    throw new Error('Failed to process image');
  }
}

// Analyze a single image
async function analyzeImage(imageBuffer: Buffer, index: number): Promise<any> {
  try {
    const { mime, data } = await processImage(imageBuffer);
    
    console.log(`[analyze-plants-batch] Sending image ${index} to OpenAI, size: ${data.length * 0.75} bytes`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using a smaller, faster model
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this plant image and provide ONLY the following information in valid JSON format, nothing else:\n{\n  \"commonName\": \"Common name in English\",\n  \"scientificName\": \"Scientific/Latin name\"\n}"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mime};base64,${data}`,
                detail: "low" // Use lower detail for faster processing
              }
            }
          ]
        }
      ],
      max_tokens: 100, // Reduce token count for faster response
      temperature: 0.1
    }, {
      timeout: 10000 // 10 second timeout
    });

    const analysisText = response.choices[0]?.message?.content;
    if (!analysisText) {
      throw new Error('No analysis received from OpenAI');
    }

    // Extract JSON from the response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from response');
    }
    
    const jsonContent = jsonMatch[0];
    return JSON.parse(jsonContent);
  } catch (error) {
    console.error(`[analyze-plants-batch] Error analyzing image ${index}:`, error);
    // Return a placeholder for failed analyses instead of throwing
    return {
      commonName: "Unknown",
      scientificName: "Analysis failed",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export const handler: Handler = async (event, context) => {
  // Set a shorter timeout for the function
  context.callbackWaitsForEmptyEventLoop = false;
  
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    console.log('[analyze-plants-batch] Request headers:', JSON.stringify(event.headers));
    
    // For direct function invocation with a test payload
    if (event.body && typeof event.body === 'string' && event.body.includes('"test":')) {
      try {
        const testPayload = JSON.parse(event.body);
        if (testPayload.test) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'Test successful' }),
          };
        }
      } catch (e) {
        // Not a JSON test payload, continue with normal processing
      }
    }
    
    if (!event.body) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No request body' }),
      };
    }

    if (!event.headers['content-type']?.includes('multipart/form-data')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Content type must be multipart/form-data' }),
      };
    }

    // Parse the multipart form data
    const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
    console.log('[analyze-plants-batch] Request body size:', bodyBuffer.length, 'bytes');
    
    // Collect all image buffers
    const imageBuffers: Buffer[] = [];
    const fileNames: string[] = [];
    
    await new Promise((resolve, reject) => {
      const bb = busboy({ 
        headers: event.headers as Record<string, string>,
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB limit per file
          files: 10 // Maximum 10 files
        }
      });
      
      bb.on('file', (fieldname, file, info) => {
        console.log('[analyze-plants-batch] Processing file:', fieldname, info);
        
        // Check if the file is an image
        // Accept both standard image types and HEIC/HEIF (which may be converted client-side)
        const isImage = info.mimeType.startsWith('image/') || 
                       info.filename.toLowerCase().endsWith('.heic') || 
                       info.filename.toLowerCase().endsWith('.heif') ||
                       info.filename.toLowerCase().endsWith('.jpg') ||
                       info.filename.toLowerCase().endsWith('.jpeg') ||
                       info.filename.toLowerCase().endsWith('.png');
        
        if (!isImage) {
          console.log('[analyze-plants-batch] Skipping non-image file:', info.mimeType, info.filename);
          file.resume();
          return;
        }
        
        const chunks: Buffer[] = [];
        file.on('data', (chunk) => chunks.push(chunk));
        file.on('end', () => {
          if (chunks.length > 0) {
            const buffer = Buffer.concat(chunks);
            console.log('[analyze-plants-batch] File collected, size:', buffer.length, 'bytes');
            imageBuffers.push(buffer);
            fileNames.push(info.filename);
          }
        });
      });
      
      bb.on('field', (name, val) => {
        console.log('[analyze-plants-batch] Form field:', name, val);
      });
      
      bb.on('finish', () => {
        console.log('[analyze-plants-batch] Form parsing complete, found', imageBuffers.length, 'images');
        resolve(true);
      });
      
      bb.on('error', (err) => {
        console.error('[analyze-plants-batch] Error parsing form:', err);
        reject(err);
      });
      
      bb.end(bodyBuffer);
    });
    
    if (imageBuffers.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No valid images found in request' }),
      };
    }
    
    // Limit the number of images to process
    const maxImages = Math.min(imageBuffers.length, 10); // Process at most 10 images
    
    // Process each image one by one instead of in parallel to avoid timeouts
    console.log(`[analyze-plants-batch] Processing ${maxImages} images for analysis sequentially`);
    const analysisResults: Array<{
      commonName: string;
      scientificName: string;
      fileName: string;
      error?: string;
    }> = [];
    
    for (let i = 0; i < maxImages; i++) {
      try {
        console.log(`[analyze-plants-batch] Processing image ${i+1} of ${maxImages}: ${fileNames[i]}`);
        const result = await analyzeImage(imageBuffers[i], i);
        analysisResults.push({
          ...result,
          fileName: fileNames[i]
        });
        console.log(`[analyze-plants-batch] Completed image ${i+1} of ${maxImages}`);
        
        // Free up memory after processing each image
        imageBuffers[i] = Buffer.alloc(0);
      } catch (error) {
        console.error(`[analyze-plants-batch] Error processing image ${i+1}:`, error);
        // Add a placeholder for failed analyses
        analysisResults.push({
          commonName: "Unknown",
          scientificName: "Analysis failed",
          fileName: fileNames[i],
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ analyses: analysisResults }),
    };
  } catch (error) {
    console.error('[analyze-plants-batch] Error processing batch plant analysis:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to process plant images',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  }
}; 