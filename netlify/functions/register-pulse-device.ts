import { Handler } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { verifyAuthToken } from './utils/firebaseAdmin';

interface UserDevice {
  deviceId: string;
  registeredAt: Date;
  deviceName?: string;
  status: 'active' | 'inactive';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGODB_DB || 'master';

// Create a MongoDB client outside the handler to enable connection reuse
let cachedClient: MongoClient | null = null;

async function connectToDatabase(): Promise<MongoClient> {
  // Check if we have a cached client
  if (cachedClient) {
    try {
      // Test if the connection is still valid with a simple command
      await cachedClient.db().command({ ping: 1 });
      console.log('Using cached MongoDB connection in register-pulse-device');
      return cachedClient;
    } catch (error) {
      console.log('Cached MongoDB connection is no longer valid, creating a new one in register-pulse-device');
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

  console.log('Creating new MongoDB connection in register-pulse-device...');
  
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
    console.log('MongoDB connection established successfully in register-pulse-device');
    
    // Save connection in cache
    cachedClient = client;
    return client;
  } catch (error) {
    console.error('MongoDB connection error in register-pulse-device:', error);
    throw error;
  }
}

export const handler: Handler = async (event, context) => {
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  console.time('register-pulse-device: Total execution time');

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  console.time('register-pulse-device: Auth verification time');
  const authHeader = event.headers.authorization;
  const authorizedUserId = await verifyAuthToken(authHeader);
  console.timeEnd('register-pulse-device: Auth verification time');

  if (!authorizedUserId) {
    console.timeEnd('register-pulse-device: Total execution time');
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized: Invalid or missing authentication token' }),
    };
  }

  let client: MongoClient | null = null;

  try {
    console.time('register-pulse-device: Parse request body');
    const body = JSON.parse(event.body || '{}');
    console.timeEnd('register-pulse-device: Parse request body');

    const { deviceId, deviceName } = body;

    if (!deviceId) {
      console.timeEnd('register-pulse-device: Total execution time');
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing required field: deviceId' }),
      };
    }

    // Connect to MongoDB
    console.time('register-pulse-device: MongoDB connection time');
    try {
      client = await connectToDatabase();
      console.timeEnd('register-pulse-device: MongoDB connection time');
    } catch (error) {
      console.timeEnd('register-pulse-device: MongoDB connection time');
      console.error('Failed to connect to MongoDB in register-pulse-device:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Database connection error' })
      };
    }

    const db = client.db(DB_NAME);
    const usersCollection = db.collection('users');

    // Check if device is already registered to another user
    console.time('register-pulse-device: Check existing device registration');
    const existingRegistration = await usersCollection.findOne({
      'pulseDevices.deviceId': deviceId
    });
    console.timeEnd('register-pulse-device: Check existing device registration');

    if (existingRegistration && existingRegistration.uid !== authorizedUserId) {
      console.timeEnd('register-pulse-device: Total execution time');
      return {
        statusCode: 409,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Device is already registered to another user' }),
      };
    }

    // Prepare device data
    const deviceData: UserDevice = {
      deviceId,
      registeredAt: new Date(),
      deviceName: deviceName || `Pulse Device ${deviceId.substring(-6)}`,
      status: 'active'
    };

    // Update user document with device registration
    console.time('register-pulse-device: MongoDB update time');
    const updateResult = await usersCollection.updateOne(
      { uid: authorizedUserId },
      {
        $addToSet: { pulseDevices: deviceData },
        $set: { updatedAt: new Date() }
      },
      { upsert: false }
    );
    console.timeEnd('register-pulse-device: MongoDB update time');

    if (updateResult.matchedCount === 0) {
      console.timeEnd('register-pulse-device: Total execution time');
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    console.log(`Device ${deviceId} successfully registered to user ${authorizedUserId}`);

    console.timeEnd('register-pulse-device: Total execution time');
    return {
      statusCode: 201,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Device registered successfully',
        deviceId,
        deviceName: deviceData.deviceName,
        registeredAt: deviceData.registeredAt,
        success: true
      }),
    };

  } catch (error) {
    console.error('Error in register-pulse-device:', error);
    console.timeEnd('register-pulse-device: Total execution time');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (error) {
        console.error('Error closing MongoDB connection:', error);
      }
    }
  }
}; 