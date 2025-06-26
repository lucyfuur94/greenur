import { Handler } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { z } from 'zod';

// Environment variables
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGODB_DB || 'master';

const requestSchema = z.object({
  plantType: z.string(),
  stageName: z.string()
});

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
} as const;

export const handler: Handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  try {
    if (!MONGO_URI) {
      throw new Error('MongoDB URI is not configured');
    }

    // Parse request
    const input = event.httpMethod === 'GET' 
      ? { 
          plantType: event.queryStringParameters?.plantType || '',
          stageName: event.queryStringParameters?.stageName || ''
        }
      : requestSchema.parse(JSON.parse(event.body || '{}'));

    if (!input.plantType || !input.stageName) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Both plantType and stageName are required' 
        })
      };
    }

    // Connect to MongoDB
    const client = new MongoClient(MONGO_URI, {
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

      // Query for the specific stage, prioritizing records with complete data
      const stageData = await collection.findOne({
        plantType: input.plantType.toLowerCase(),
        stageName: input.stageName.toLowerCase(),
        durationDays: { $exists: true },
        totalDaysFromStart: { $exists: true },
        care: { $exists: true }
      }) || await collection.findOne({
        plantType: input.plantType.toLowerCase(),
        stageName: input.stageName.toLowerCase()
      });

      if (!stageData) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Growth stage not found',
            plantType: input.plantType,
            stageName: input.stageName
          })
        };
      }

      // Check if required fields exist
      const durationDays = stageData.durationDays || { min: 0, max: 0 };
      const totalDaysFromStart = stageData.totalDaysFromStart || { start: 0, end: 0 };

      // Return the static data
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          details: {
            stage: stageData.stageName,
            description: stageData.stageDescription,
            order: stageData.stageOrder,
            duration: `${durationDays.min}-${durationDays.max} days`,
            totalDaysFromStart: `Day ${totalDaysFromStart.start} to ${totalDaysFromStart.end}`,
            durationDays: durationDays,
            totalDaysFromStartObject: totalDaysFromStart,
            care: stageData.care || [],
            issues: stageData.commonIssues || [],
            indicators: stageData.indicators || [],
            plantType: stageData.plantType,
            imageUrl: stageData.imageUrl
          }
        })
      };

    } finally {
      await client.close();
    }

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const statusCode = error instanceof z.ZodError ? 400 : 500;
    
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      })
    };
  }
}; 