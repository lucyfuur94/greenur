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
  plantData: z.string(), // JSON string from initial API response
  experience: z.enum(['beginner', 'intermediate', 'expert']).optional(),
  gardenType: z.enum(['indoor', 'outdoor', 'greenhouse']).optional(),
  interests: z.array(z.string()).optional(),
  location: z.string().optional(),
  currentWeather: z.object({
    temp: z.number(),
    humidity: z.number(),
    precipitation: z.number()
  }).optional().nullable(),
  forecast: z.array(z.object({
    date: z.string(),
    temp: z.number(),
    condition: z.string()
  })).optional().nullable()
});

const responseSchema = z.object({
  basicRecommendations: z.object({
    experienceLevel: z.string(),
    locationAdvice: z.string(),
    temperatureAdaptability: z.string(),
    bestSeason: z.string(),
    placement: z.string()
  }),
  growingConditions: z.object({
    light: z.string(),
    water: z.string(),
    soil: z.string(),
    temperature: z.string(),
    wind: z.string(),
    fertilizer: z.string()
  }),
  growthStages: z.array(
    z.object({
      stage: z.string(),
      duration: z.string(),
      care: z.array(z.string()),
      issues: z.array(z.string()),
      indicators: z.array(z.string())
    })
  ),
  careCalendar: z.object({
    seasonal: z.object({
      spring: z.array(z.string()),
      summer: z.array(z.string()),
      fall: z.array(z.string()),
      winter: z.array(z.string())
    }),
    watering: z.object({
      frequency: z.string(),
      amount: z.string(),
      notes: z.array(z.string())
    }),
    maintenance: z.object({
      pruning: z.string(),
      repotting: z.string(),
      fertilizing: z.string()
    })
  })
});

export const handler: Handler = async (event) => {
  try {
    if (!process.env.VITE_OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    const input = requestSchema.parse(JSON.parse(event.body || '{}'));
    
    const systemPrompt = `You are a expert botanist specializing in home gardening. Analyze the following plant data and user context to provide detailed cultivation guidance. Follow these rules:
1. Only respond to plant-related queries
2. Use metric units (Celsius, mm)
3. Structure output in JSON format with these keys:
   - basicRecommendations (object: experienceLevel, locationAdvice, temperatureAdaptability, bestSeason, placement)
   - growingConditions (object: light, water, soil, temperature, wind, fertilizer)
   - growthStages (array: {stage, duration, care[], issues[], indicators[]})
   - careCalendar (object: seasonal{spring[], summer[], fall[], winter[]}, watering{frequency, amount, notes[]}, maintenance{pruning, repotting, fertilizing})
4. Be concise but informative
5. Never include phrases about current conditions being optimal`;

    const userPromptParts = [
      'Plant Information:',
      `- Common Name: ${input.plantName}`,
      `- Scientific Name: ${input.scientificName}`,
      `- Type: ${input.plantType}`,
      input.experience && `- Gardener Experience: ${input.experience}`,
      input.gardenType && `- Garden Type: ${input.gardenType}`,
      input.interests?.length && `- Interests: ${input.interests.join(', ')}`,
      input.location && `- Location: ${input.location}`,
      input.currentWeather && `Current Weather: ${input.currentWeather.temp}°C, ${input.currentWeather.humidity}% humidity`,
      input.forecast?.length && `3-Day Forecast: ${input.forecast.map(f => `${f.date}: ${f.temp}°C, ${f.condition}`).join(' | ')}`
    ].filter(Boolean);

    const userPrompt = `${userPromptParts.join('\n')}\n\nProvide detailed cultivation guidance following the required format.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 1500
    });

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
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
        body: JSON.stringify({
          details: parsedResponse,
          rawData: input.plantData
        })
      };
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.error('Original response:', generatedText);
      
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Failed to parse plant analysis response',
          details: parseError.message,
          rawResponse: generatedText 
        })
      };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: error instanceof z.ZodError ? 400 : 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}; 