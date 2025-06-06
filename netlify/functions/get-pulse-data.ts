import { Handler } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { verifyAuthToken } from './utils/firebaseAdmin'; // Import shared utility

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGODB_DB || 'master';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// Create a MongoDB client outside the handler to enable connection reuse
let cachedClient: MongoClient | null = null;

async function connectToDatabase(): Promise<MongoClient> {
  // Check if we have a cached client
  if (cachedClient) {
    try {
      // Test if the connection is still valid with a simple command
      await cachedClient.db().command({ ping: 1 });
      console.log('Using cached MongoDB connection in get-pulse-data');
      return cachedClient;
    } catch (error) {
      console.log('Cached MongoDB connection is no longer valid, creating a new one in get-pulse-data');
      // If ping fails, connection is no longer valid, so continue to create a new one
      // First, try to close the invalid connection to prevent leaks
      try {
        await cachedClient.close();
      } catch (closeError) {
        // Ignore errors when closing an already broken connection
      }
      cachedClient = null;
    }
  }

  console.log('Creating new MongoDB connection in get-pulse-data...');
  
  if (!MONGO_URI) {
    throw new Error('MongoDB URI is not defined');
  }

  try {
    // Optimize MongoDB connection options
    const client = new MongoClient(MONGO_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      // Set reasonable timeouts
      connectTimeoutMS: 5000, // 5 seconds
      socketTimeoutMS: 5000,  // 5 seconds
    });

    // Test the connection before proceeding
    await client.connect();
    console.log('MongoDB connection established successfully in get-pulse-data');
    
    // Save connection in cache
    cachedClient = client;
    return client;
  } catch (error) {
    console.error('MongoDB connection error in get-pulse-data:', error);
    throw error;
  }
}

export const handler: Handler = async (event, context) => {
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  console.time('get-pulse-data: Total execution time');

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  console.time('get-pulse-data: Auth verification time');
  const authHeader = event.headers.authorization;
  const authorizedUserId = await verifyAuthToken(authHeader);
  console.timeEnd('get-pulse-data: Auth verification time');

  if (!authorizedUserId) {
    console.timeEnd('get-pulse-data: Total execution time');
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized: Invalid or missing authentication token' }),
    };
  }

  const deviceId = event.queryStringParameters?.deviceId;
  if (!deviceId) {
    console.timeEnd('get-pulse-data: Total execution time');
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing required query parameter: deviceId' }),
    };
  }

  let client: MongoClient | null = null;

  try {
    // Connect to MongoDB
    console.time('get-pulse-data: MongoDB connection time');
    try {
      client = await connectToDatabase();
      console.timeEnd('get-pulse-data: MongoDB connection time');
    } catch (error) {
      console.timeEnd('get-pulse-data: MongoDB connection time');
      console.error('Failed to connect to MongoDB in get-pulse-data:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Database connection error' })
      };
    }

    console.time('get-pulse-data: MongoDB query time');
    const db = client.db(DB_NAME);
    const collection = db.collection('pulse_data_logs');

    // Fetch data for the given deviceId, sorted by timestamp in descending order
    // The TTL index automatically handles keeping only the last 3 days of data
    const data = await collection
      .find({ deviceId: deviceId })
      .sort({ timestamp: -1 }) // -1 for descending, 1 for ascending
      .toArray();
    console.timeEnd('get-pulse-data: MongoDB query time');

    console.timeEnd('get-pulse-data: Total execution time');
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(data),
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error fetching pulse data:', errorMessage, error);
    console.timeEnd('get-pulse-data: Total execution time');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Failed to fetch data', 
        details: errorMessage 
      }),
    };
  }
}; 