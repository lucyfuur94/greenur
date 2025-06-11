import { Handler } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { verifyAuthToken } from './utils/firebaseAdmin';

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
  if (cachedClient) {
    try {
      await cachedClient.db().command({ ping: 1 });
      return cachedClient;
    } catch (error) {
      try {
        await cachedClient.close();
      } catch (closeError) {
        // Ignore errors when closing an already broken connection
      }
      cachedClient = null;
    }
  }

  if (!MONGO_URI) {
    throw new Error('MongoDB URI is not defined');
  }

  const client = new MongoClient(MONGO_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    connectTimeoutMS: 5000,
    socketTimeoutMS: 5000,
  });

  await client.connect();
  cachedClient = client;
  return client;
}

export const handler: Handler = async (event, context) => {
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

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

  // Verify authentication
  const authHeader = event.headers.authorization;
  const authorizedUserId = await verifyAuthToken(authHeader);

  if (!authorizedUserId) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized: Invalid or missing authentication token' }),
    };
  }

  const deviceId = event.queryStringParameters?.deviceId;
  if (!deviceId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing required query parameter: deviceId' }),
    };
  }

  try {
    // Connect to MongoDB
    const client = await connectToDatabase();
    const db = client.db(DB_NAME);

    // First, verify the user owns this device
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ uid: authorizedUserId });
    
    if (!user || !user.pulseDevices || !user.pulseDevices.some((device: any) => device.deviceId === deviceId)) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Device not found or access denied' }),
      };
    }

    // Check recent activity in pulse_data_logs
    const dataCollection = db.collection('pulse_data_logs');
    const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    // Get the most recent data point
    const latestData = await dataCollection
      .findOne(
        { deviceId: deviceId },
        { sort: { timestamp: -1 } }
      );

    if (!latestData) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          status: 'no_data',
          message: 'Device has never sent data',
          online: false,
          lastSeen: null
        }),
      };
    }

    const lastSeenTime = new Date(latestData.timestamp);
    let status: string;
    let online: boolean;
    let message: string;

    if (lastSeenTime > oneMinuteAgo) {
      status = 'online';
      online = true;
      message = 'Device is online and actively sending data (< 1 minute)';
    } else if (lastSeenTime > fiveMinutesAgo) {
      status = 'recent';
      online = true;
      message = 'Device was recently active (1-5 minutes ago)';
    } else {
      status = 'offline';
      online = false;
      message = 'Device appears to be offline (> 5 minutes since last data)';
    }

    // Count total data points for additional info
    const totalDataPoints = await dataCollection.countDocuments({ deviceId: deviceId });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        status,
        online,
        message,
        lastSeen: latestData.timestamp,
        lastSeenFormatted: lastSeenTime.toISOString(),
        totalDataPoints,
        latestReading: {
          lightLevel: latestData.lightLevel,
          temperature: latestData.temperature,
          humidity: latestData.humidity,
          soilMoisture: latestData.soilMoisture
        }
      }),
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error checking device status:', errorMessage, error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Failed to check device status', 
        details: errorMessage 
      }),
    };
  }
}; 