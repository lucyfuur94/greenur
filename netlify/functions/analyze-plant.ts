import { Handler } from '@netlify/functions'
import OpenAI from 'openai'
import * as Jimp from 'jimp'
import Busboy from 'busboy'
import sharp from 'sharp'

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY
})

async function processImage(buffer: Buffer): Promise<{ mime: string; data: string }> {
  try {
    // Optimize image processing for faster analysis
    const processedBuffer = await sharp(buffer)
      .jpeg({ quality: 80 }) // Slightly reduce quality for faster processing
      .resize(400, 400, { // Reduce size while maintaining recognizable details
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

  // Try to find JSON directly in the text
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
    commonName: "Unknown Plant",
    scientificName: "Species unknown",
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
  
  if (!process.env.VITE_OPENAI_API_KEY) {
    console.error('[analyze-plant] OpenAI API key is not configured');
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'OpenAI API key is not configured' })
    }
  }

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

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
      max_tokens: 150, // Reduce max tokens since we need less
      temperature: 0.1 // Lower temperature for more consistent and faster responses
    }, {
      timeout: 8000 // 8 second timeout in the request options
    });

    const analysisText = response.choices[0]?.message?.content;
    if (!analysisText) {
      throw new Error('No analysis received from OpenAI');
    }

    console.log('Raw OpenAI response:', analysisText);

    // Extract and parse JSON from the response
    const analysis = extractJsonFromText(analysisText);
    console.log('Parsed analysis:', analysis);

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