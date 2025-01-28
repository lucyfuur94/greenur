import { Handler } from '@netify/functions'
import OpenAI from 'openai'
import * as Jimp from 'jimp'
import Busboy from 'busboy'
import sharp from 'sharp'

// More detailed environment variable logging
console.log('Environment variables:', {
  hasOpenAIKey: !!process.env.OPENAI_API_KEY,
  keyLength: process.env.OPENAI_API_KEY?.length,
  nodeEnv: process.env.NODE_ENV,
})

if (!process.env.OPENAI_API_KEY) {
  console.error('OpenAI API key is missing from environment variables')
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Add type imports
import type { Form } from 'multiparty';

async function processImage(buffer: Buffer): Promise<{ mime: string; data: string }> {
  try {
    const image = await Jimp.read(buffer);
    
    // Maintain aspect ratio while resizing
    const maxDimension = 512;
    const width = image.getWidth();
    const height = image.getHeight();
    
    let newWidth = width;
    let newHeight = height;
    
    if (width > height && width > maxDimension) {
      newWidth = maxDimension;
      newHeight = Math.floor(height * (maxDimension / width));
    } else if (height > maxDimension) {
      newHeight = maxDimension;
      newWidth = Math.floor(width * (maxDimension / height));
    }

    const converted = image
      .resize(newWidth, newHeight)
      .quality(85)
      .getBufferAsync(Jimp.MIME_JPEG);

    return { 
      mime: Jimp.MIME_JPEG,
      data: (await converted).toString('base64')
    };
  } catch (error) {
    console.error('Image processing failed:', error);
    throw new Error('Failed to convert image to JPEG format');
  }
}

const handler: Handler = async (event) => {
  if (!process.env.OPENAI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'OpenAI API key is not configured' })
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    let imageBuffer: Buffer | undefined;

    if (event.headers['content-type']?.includes('multipart/form-data')) {
      const bodyBuffer = Buffer.from(event.body || '', 'base64');
      
      // Create form parser
      const busboy = Busboy({
        headers: event.headers,
        limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
      });
      
      await new Promise((resolve, reject) => {
        busboy.on('file', (fieldname, file, info) => {
          if (fieldname !== 'image') return file.resume();
          
          const chunks: Buffer[] = [];
          file.on('data', (chunk) => chunks.push(chunk));
          file.on('end', () => {
            imageBuffer = Buffer.concat(chunks);
            resolve(true);
          });
        });
        
        busboy.on('error', reject);
        busboy.end(bodyBuffer);
      });
    } 
    // Handle base64 encoded body
    else if (event.isBase64Encoded && event.body) {
      imageBuffer = Buffer.from(event.body, 'base64');
    }

    if (!imageBuffer) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'No image data received' })
      };
    }

    // Convert image to JPEG buffer with quality setting
    const jpegBuffer = await sharp(imageBuffer)
      .jpeg({ quality: 80 })
      .toBuffer()
      .catch(err => {
        throw new Error('Failed to convert image to JPEG - unsupported format');
      });

    const { mime, data } = await processImage(jpegBuffer);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this plant image and respond in JSON format with these fields:
{
  "commonName": "Common name in English",
  "scientificName": "Scientific/Latin name"
}
Ensure valid JSON format.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mime};base64,${data}`,
                detail: "auto"
              }
            }
          ]
        }
      ]
    });

    const analysisText = response.choices[0]?.message?.content;
    if (!analysisText) {
      throw new Error('No analysis received from OpenAI');
    }

    // Extract JSON from the response (handles both plain JSON and markdown code blocks)
    const jsonMatch = analysisText.match(/```json\n?(.*?)\n?```/s) || [null, analysisText];
    const jsonStr = jsonMatch[1].trim();
    
    const analysis = JSON.parse(jsonStr);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis })
    }
  } catch (error) {
    console.error('Error processing image:', error);
    return {
      statusCode: error.message.includes('unsupported format') ? 400 : 500,
      body: JSON.stringify({ 
        error: error.message.includes('unsupported format') 
          ? 'Unsupported image format. Please use JPEG or PNG.'
          : 'Failed to process image'
      })
    };
  }
}

export { handler } 