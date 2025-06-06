import { Handler } from '@netlify/functions';
import { z } from 'zod';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY,
});

const requestSchema = z.object({
  plantName: z.string(),
  scientificName: z.string(),
  plantType: z.string(),
  season: z.string()
});

// Generate prompts for the request
const generatePrompts = (input: z.infer<typeof requestSchema>) => ({
  systemPrompt: `You are a expert botanist specializing in home gardening. Analyze the following plant and season information to provide detailed seasonal care guidance. Follow these rules:
1. Only respond to plant-related queries
2. Use metric units (Celsius, mm)
3. Provide care instructions as a numbered list, with each item on a new line
4. Be concise but informative
5. Focus only on the requested season
6. DO NOT include any JSON or markdown formatting in your response
7. Start each care instruction with a number followed by a period (e.g., "1. Water sparingly during winter")`,
  
  userPrompt: `
Plant Information:
- Common Name: ${input.plantName}
- Scientific Name: ${input.scientificName}
- Type: ${input.plantType}
- Season: ${input.season}

Provide detailed care instructions for the "${input.season}" season for this plant, including specific tasks, adjustments to watering, fertilizing, pruning, and any other seasonal considerations.`
});

export const handler: Handler = async (event, context) => {
  // Disable waiting for empty event loop to prevent timeouts
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }
  
  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
      },
      body: ''
    };
  }
  
  try {
    // Check API key
    if (!process.env.VITE_OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }
    
    // Parse request data from either body (POST) or query (GET)
    let requestData;
    
    if (event.httpMethod === 'POST') {
      requestData = JSON.parse(event.body || '{}');
    } else if (event.httpMethod === 'GET') {
      // For GET requests, look for the data parameter
      const dataParam = event.queryStringParameters?.data;
      
      if (!dataParam) {
        // If no data parameter, try to use individual query parameters
        const { plantName, scientificName, plantType, season } = event.queryStringParameters || {};
        
        if (plantName && scientificName && plantType && season) {
          requestData = { plantName, scientificName, plantType, season };
        } else {
          throw new Error('Missing required parameters: plantName, scientificName, plantType, season');
        }
      } else {
        try {
          requestData = JSON.parse(decodeURIComponent(dataParam));
        } catch (error) {
          throw new Error('Invalid data parameter format');
        }
      }
    } else {
      throw new Error('Unsupported HTTP method');
    }
    
    console.log('Request data:', requestData);
    
    // Validate the request
    const input = requestSchema.parse(requestData);
    
    // Generate prompts
    const { systemPrompt, userPrompt } = generatePrompts(input);
    
    // Create streaming response from OpenAI
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 800,
      stream: true,
    });
    
    // Set up headers for server-sent events
    const headers = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
    };
    
    // Send the initial event with header text
    let responseBody = `event: message\ndata: Care instructions for ${input.season}:\n\n\n`;
    
    // Process each chunk from OpenAI
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        // Format as SSE event
        responseBody += `event: message\ndata: ${content}\n\n`;
      }
    }
    
    // End the stream
    responseBody += `event: done\ndata: \n\n`;
    
    return {
      statusCode: 200,
      headers,
      body: responseBody,
      isBase64Encoded: false
    };
  } catch (error) {
    console.error('Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const statusCode = error instanceof z.ZodError ? 400 : 500;
    
    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
      },
      body: JSON.stringify({ error: errorMessage })
    };
  }
}; 