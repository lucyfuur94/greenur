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
  stageName: z.string()
});

const responseSchema = z.object({
  stage: z.string(),
  duration: z.string(),
  care: z.array(z.string()),
  issues: z.array(z.string()),
  indicators: z.array(z.string())
});

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
} as const;

const TIMEOUT_MS = 15000; // 15 seconds, leaving time for cleanup

export const handler: Handler = async (event, context) => {
  // Disable waiting for empty event loop to prevent timeouts
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  const abortController = new AbortController();
  let timeoutId: NodeJS.Timeout | null = null;

  try {
    if (!process.env.VITE_OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    const input = requestSchema.parse(JSON.parse(event.body || '{}'));
    
    const systemPrompt = `You are a expert botanist specializing in home gardening. Analyze the following plant and growth stage information to provide detailed guidance for this specific growth stage. Follow these rules:
1. Only respond to plant-related queries
2. Use metric units (Celsius, mm)
3. Structure output in JSON format with these keys:
   - stage (string: the name of the growth stage)
   - duration (string: how long this stage typically lasts)
   - care (array of strings: specific care instructions for this stage)
   - issues (array of strings: common problems during this stage)
   - indicators (array of strings: signs of healthy growth during this stage)
4. Be concise but informative
5. Focus only on the requested growth stage`;

    const userPrompt = `
Plant Information:
- Common Name: ${input.plantName}
- Scientific Name: ${input.scientificName}
- Type: ${input.plantType}
- Growth Stage: ${input.stageName}

Provide detailed information about the "${input.stageName}" growth stage for this plant, including care requirements, common issues, and success indicators.`;

    try {
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, TIMEOUT_MS);

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 800
      }, { signal: abortController.signal });

      if (timeoutId) clearTimeout(timeoutId);

      const generatedText = response.choices[0].message?.content || '';
      console.log('Raw model response:', generatedText);

      // Clean the response and parse
      try {
        const cleanJsonString = generatedText
          .replace(/```json/g, '')
          .replace(/```/g, '')
          .trim();

        const parsedResponse = responseSchema.parse(JSON.parse(cleanJsonString));
        console.log('Parsed response:', parsedResponse);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            details: parsedResponse
          })
        };
      } catch (parseError) {
        console.error('JSON parsing failed:', parseError);
        console.error('Original response:', generatedText);
        
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Failed to parse growth stage details response',
            details: parseError.message,
            rawResponse: generatedText 
          })
        };
      }
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        throw new Error('OpenAI request timeout');
      }
      throw error;
    }
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const statusCode = error instanceof z.ZodError ? 400 : 
                      errorMessage.includes('timeout') ? 504 :
                      500;
    
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      })
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    abortController.abort();
  }
}; 