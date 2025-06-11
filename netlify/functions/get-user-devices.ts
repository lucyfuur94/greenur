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
      console.log('Using cached MongoDB connection in get-user-devices');
      return cachedClient;
    } catch (error) {
      console.log('Cached MongoDB connection is no longer valid, creating a new one in get-user-devices');
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

  console.log('Creating new MongoDB connection in get-user-devices...');
  
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
    console.log('MongoDB connection established successfully in get-user-devices');
    
    // Save connection in cache
    cachedClient = client;
    return client;
  } catch (error) {
    console.error('MongoDB connection error in get-user-devices:', error);
    throw error;
  }
}

export const handler: Handler = async (event, context) => {
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  console.time('get-user-devices: Total execution time');

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

  console.time('get-user-devices: Auth verification time');
  const authHeader = event.headers.authorization;
  const authorizedUserId = await verifyAuthToken(authHeader);
  console.timeEnd('get-user-devices: Auth verification time');

  if (!authorizedUserId) {
    console.timeEnd('get-user-devices: Total execution time');
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Unauthorized: Invalid or missing authentication token' }),
    };
  }

  let client: MongoClient | null = null;

  try {
    // Connect to MongoDB
    console.time('get-user-devices: MongoDB connection time');
    try {
      client = await connectToDatabase();
      console.timeEnd('get-user-devices: MongoDB connection time');
    } catch (error) {
      console.timeEnd('get-user-devices: MongoDB connection time');
      console.error('Failed to connect to MongoDB in get-user-devices:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Database connection error' })
      };
    }

    const db = client.db(DB_NAME);
    const usersCollection = db.collection('users');

    // Get user data with pulse devices
    console.time('get-user-devices: MongoDB query time');
    const user = await usersCollection.findOne(
      { uid: authorizedUserId },
      { projection: { pulseDevices: 1, uid: 1 } }
    );
    console.timeEnd('get-user-devices: MongoDB query time');

    if (!user) {
      console.timeEnd('get-user-devices: Total execution time');
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User not found' }),
      };
    }

    // Return user pulse devices
    const pulseDevices = user.pulseDevices || [];
    
    console.log(`Retrieved ${pulseDevices.length} pulse devices for user ${authorizedUserId}`);

    console.timeEnd('get-user-devices: Total execution time');
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        devices: pulseDevices,
        count: pulseDevices.length
      }),
    };

  } catch (error) {
    console.error('Error in get-user-devices:', error);
    console.timeEnd('get-user-devices: Total execution time');
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}; 