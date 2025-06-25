import { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGODB_DB || 'master';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
};

const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const queryParams = event.queryStringParameters || {};
    const { plantType, stageName, limit = '50' } = queryParams;

    // Build query filter
    const filter: any = {};
    if (plantType) {
      filter.plantType = plantType.toLowerCase();
    }
    if (stageName) {
      filter.stageName = stageName.toLowerCase();
    }

    // Connect to MongoDB
    const client = new MongoClient(MONGO_URI!, {
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

      // Query with sorting by stageOrder and uploadedAt
      const results = await collection
        .find(filter)
        .sort({ plantType: 1, stageOrder: 1, uploadedAt: -1 })
        .limit(parseInt(limit))
        .toArray();

      // If requesting specific plant type, group by stages
      if (plantType && !stageName) {
        const groupedByStage = results.reduce((acc, item) => {
          const stage = item.stageName;
          if (!acc[stage]) {
            acc[stage] = [];
          }
          acc[stage].push(item);
          return acc;
        }, {} as Record<string, any[]>);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            success: true,
            plantType: plantType.toLowerCase(),
            stageCount: Object.keys(groupedByStage).length,
            totalImages: results.length,
            stages: groupedByStage
          })
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          count: results.length,
          data: results
        })
      };

    } finally {
      await client.close();
    }

  } catch (error) {
    console.error('[get-growth-stage-images] Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

export { handler }; 