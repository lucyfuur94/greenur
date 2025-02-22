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
  
  if (!process.env.VITE_OPENAI_API_KEY) {
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
    
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No image data received' })
      };
    }

    if (event.headers['content-type']?.includes('multipart/form-data')) {
      const busboy = Busboy({ headers: event.headers });
      const bodyBuffer = Buffer.from(event.body, 'base64');

      await new Promise((resolve, reject) => {
        busboy.on('file', (fieldname, file, info) => {
          if (fieldname !== 'image') {
            file.resume();
            return;
          }

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
    } else {
      imageBuffer = Buffer.from(event.body, 'base64');
    }

    if (!imageBuffer) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No image data found in request' })
      };
    }

    const { mime, data } = await processImage(imageBuffer);

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
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify({ analysis })
    };
  } catch (error) {
    console.error('Error processing image:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to process image',
        details: error instanceof Error ? error.stack : undefined
      })
    };
  }
} 