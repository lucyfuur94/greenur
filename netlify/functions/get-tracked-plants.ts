import { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGODB_DB || 'master';

export const handler: Handler = async (event) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Get userId from query parameters
  const userId = event.queryStringParameters?.userId;
  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'userId is required' }),
    };
  }

  let client: MongoClient | null = null;

  try {
    // Connect to MongoDB
    if (!MONGO_URI) {
      throw new Error('MongoDB URI is not defined');
    }
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Get user's tracked plants
    const plants = await db.collection('user_plants')
      .find({ userId })
      .sort({ dateAdded: -1 })
      .toArray();

    // Return empty array if no plants found (don't treat as error)
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
      },
      body: JSON.stringify({ plants: plants || [] }),
    };
  } catch (error) {
    console.error('Error fetching tracked plants:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch tracked plants' }),
    };
  } finally {
    if (client) {
      await client.close();
    }
  }
};