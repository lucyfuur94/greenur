import { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGODB_DB || 'master';
const COLLECTION_NAME = 'appSettings';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

export const handler: Handler = async (event, context) => {
  // Disable waiting for empty event loop to prevent timeouts
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  let client: MongoClient | null = null;

  try {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: corsHeaders,
        body: ''
      };
    }

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    // Connect to MongoDB
    if (!MONGO_URI) {
      throw new Error('MongoDB URI is not defined');
    }
    
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    const appSettingsCollection = db.collection(COLLECTION_NAME);

    // Get app settings
    const appSettings = await appSettingsCollection.findOne({ id: 'global' });
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        settings: appSettings?.settings || {}
      })
    };

  } catch (error) {
    console.error('Error handling app settings:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof Error ? error.stack : undefined
      })
    };
  } finally {
    if (client) {
      await client.close();
    }
  }
}; 