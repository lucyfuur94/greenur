import { Handler } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGODB_DB || 'master';
const PULSE_DEVICE_API_KEY = process.env.PULSE_DEVICE_API_KEY; // New Env Variable

interface PulseDataLog {
  deviceId: string;
  timestamp: Date; // Server timestamp when data was received
  temperature?: number;
  humidity?: number;
  soilMoisture?: number;
  lightLevel?: number; // Added for light sensor
  isWaterOn?: number; // 1 for on, 0 for off
  threshold?: number; // User-set threshold for watering
  sourceIp?: string; // Added for logging client IP
  originalTimestamp?: string; // Original timestamp from ESP32 (for debugging)
  // Add other potential sensor readings here
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*', // Or restrict to specific origins if needed
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Create a MongoDB client outside the handler to enable connection reuse
let cachedClient: MongoClient | null = null;

async function connectToDatabase(): Promise<MongoClient> {
  // Check if we have a cached client
  if (cachedClient) {
    try {
      // Test if the connection is still valid with a simple command
      await cachedClient.db().command({ ping: 1 });
      console.log('Using cached MongoDB connection in log-pulse-data');
      return cachedClient;
    } catch (error) {
      console.log('Cached MongoDB connection is no longer valid, creating a new one in log-pulse-data');
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

  console.log('Creating new MongoDB connection in log-pulse-data...');
  
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
    console.log('MongoDB connection established successfully in log-pulse-data');
    
    // Save connection in cache
    cachedClient = client;
    return client;
  } catch (error) {
    console.error('MongoDB connection error in log-pulse-data:', error);
    throw error;
  }
}

export const handler: Handler = async (event, context) => {
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  console.time('log-pulse-data: Total execution time');

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    console.timeEnd('log-pulse-data: Total execution time');
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const apiKey = event.headers['x-api-key'];
  if (!PULSE_DEVICE_API_KEY || apiKey !== PULSE_DEVICE_API_KEY) {
    console.timeEnd('log-pulse-data: Total execution time');
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized: Invalid API Key' }),
    };
  }

  let client: MongoClient | null = null;

  try {
    if (!PULSE_DEVICE_API_KEY) {
      console.warn('PULSE_DEVICE_API_KEY environment variable is not set. API will be insecure.');
      // Depending on policy, you might want to return an error here if the key isn't set.
    }

    console.time('log-pulse-data: Parse request body');
    const body = JSON.parse(event.body || '{}');
    console.timeEnd('log-pulse-data: Parse request body');

    if (!body.deviceId || !body.timestamp) {
      console.timeEnd('log-pulse-data: Total execution time');
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing required fields: deviceId and timestamp' }),
      };
    }

    const sourceIp = event.headers['x-forwarded-for'] || 
                      event.headers['x-nf-client-connection-ip'] || 
                      event.headers['client-ip'] ||
                      event.headers['x-real-ip'];

    const dataToLog: PulseDataLog = {
      deviceId: body.deviceId,
      timestamp: new Date(), // Use server timestamp instead of trusting ESP32 timestamp
      temperature: body.temperature,
      humidity: body.humidity,
      soilMoisture: body.soilMoisture,
      lightLevel: body.lightLevel,
      isWaterOn: body.isWaterOn,
      threshold: body.threshold,
      sourceIp: sourceIp, // Store the captured IP
      // Store original ESP32 timestamp for debugging purposes
      originalTimestamp: body.timestamp,
    };

    // Connect to MongoDB
    console.time('log-pulse-data: MongoDB connection time');
    try {
      client = await connectToDatabase();
      console.timeEnd('log-pulse-data: MongoDB connection time');
    } catch (error) {
      console.timeEnd('log-pulse-data: MongoDB connection time');
      console.error('Failed to connect to MongoDB in log-pulse-data:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Database connection error' })
      };
    }

    console.time('log-pulse-data: MongoDB insert time');
    const db = client.db(DB_NAME);
    const collection = db.collection('pulse_data_logs');

    const result = await collection.insertOne(dataToLog);
    console.timeEnd('log-pulse-data: MongoDB insert time');

    if (result.acknowledged) {
      console.timeEnd('log-pulse-data: Total execution time');
      return {
        statusCode: 201, // 201 Created
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Data logged successfully', id: result.insertedId }),
      };
    } else {
      throw new Error('Failed to insert data into MongoDB');
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error logging pulse data:', errorMessage, error);
    console.timeEnd('log-pulse-data: Total execution time');
    return {
      statusCode: error instanceof SyntaxError ? 400 : 500, // Bad request for JSON parsing errors
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Failed to log data', 
        details: errorMessage 
      }),
    };
  }
};

// Reminder:
// 1. Set PULSE_DEVICE_API_KEY environment variable in your Netlify project settings.
// 2. In MongoDB Atlas (or your MongoDB provider), create a TTL index on the 'timestamp' 
//    field for the 'pulse_data_logs' collection. Example:
//    db.pulse_data_logs.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 259200 }); // 3 days 