import { Handler } from '@netlify/functions';
import { MongoClient, ServerApiVersion } from 'mongodb';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGODB_DB || 'master';
const JWT_SECRET = process.env.JWT_SECRET;

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Create a MongoDB client outside the handler to enable connection reuse
let cachedClient: MongoClient | null = null;

async function connectToDatabase(): Promise<MongoClient> {
  if (cachedClient) {
    try {
      await cachedClient.db().command({ ping: 1 });
      console.log('Using cached MongoDB connection in update-device-threshold');
      return cachedClient;
    } catch (error) {
      console.log('Cached MongoDB connection is no longer valid, creating a new one in update-device-threshold');
      try {
        await cachedClient.close();
      } catch (closeError) {
        // Ignore errors when closing an already broken connection
      }
      cachedClient = null;
    }
  }

  console.log('Creating new MongoDB connection in update-device-threshold...');
  
  if (!MONGO_URI) {
    throw new Error('MongoDB URI is not defined');
  }

  try {
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
    console.log('MongoDB connection established successfully in update-device-threshold');
    
    cachedClient = client;
    return client;
  } catch (error) {
    console.error('MongoDB connection error in update-device-threshold:', error);
    throw error;
  }
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

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  let client: MongoClient | null = null;

  try {
    // Verify JWT token
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing or invalid authorization header' }),
      };
    }

    const token = authHeader.split(' ')[1];
    let decodedToken: any;

    try {
      decodedToken = jwt.verify(token, JWT_SECRET!);
    } catch (error) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Invalid token' }),
      };
    }

    const userId = decodedToken.userId;
    const body = JSON.parse(event.body || '{}');

    if (!body.deviceId || typeof body.threshold !== 'number') {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing required fields: deviceId and threshold' }),
      };
    }

    if (body.threshold < 0 || body.threshold > 100) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Threshold must be between 0 and 100' }),
      };
    }

    client = await connectToDatabase();
    const db = client.db(DB_NAME);

    // Verify user owns this device
    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({
      _id: userId,
      'pulseDevices.deviceId': body.deviceId
    });

    if (!user) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Device not found or access denied' }),
      };
    }

    // Update the device threshold in user's pulseDevices array
    const updateResult = await usersCollection.updateOne(
      {
        _id: userId,
        'pulseDevices.deviceId': body.deviceId
      },
      {
        $set: {
          'pulseDevices.$.threshold': body.threshold,
          'pulseDevices.$.updatedAt': new Date()
        }
      }
    );

    if (!updateResult.acknowledged || updateResult.modifiedCount === 0) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to update threshold' }),
      };
    }

    // Also log this threshold change to pulse_data_logs for tracking
    const logsCollection = db.collection('pulse_data_logs');
    await logsCollection.insertOne({
      deviceId: body.deviceId,
      timestamp: new Date(),
      threshold: body.threshold,
      sourceIp: event.headers['x-forwarded-for'] || 
                event.headers['x-nf-client-connection-ip'] || 
                event.headers['client-ip'] ||
                event.headers['x-real-ip'],
      isThresholdUpdate: true, // Flag to identify threshold updates
      updatedBy: userId
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: true, 
        message: 'Threshold updated successfully',
        threshold: body.threshold
      }),
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error updating device threshold:', errorMessage, error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Failed to update threshold', 
        details: errorMessage 
      }),
    };
  }
}; 