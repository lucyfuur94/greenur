import { Handler } from '@netlify/functions'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

interface UserProfile {
  displayName?: string;
  photoURL?: string;
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
} as const;

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

    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    const userId = event.queryStringParameters?.userId;
    if (!userId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User ID is required' })
      };
    }

    const profileData: UserProfile = JSON.parse(event.body || '{}');
    
    // Validate profile data
    if (Object.keys(profileData).length === 0) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'No profile data provided' })
      };
    }

    // Connect to MongoDB
    if (!MONGO_URI) {
      throw new Error('MongoDB URI is not defined');
    }
    
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    const usersCollection = db.collection('users');

    // Update user profile
    const result = await usersCollection.updateOne(
      { uid: userId },
      { 
        $set: { 
          ...(profileData.displayName && { displayName: profileData.displayName }),
          ...(profileData.photoURL && { photoURL: profileData.photoURL }),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    if (result.modifiedCount === 0 && result.upsertedCount === 0) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to update profile' })
      };
    }

    // Get updated user data
    const updatedUser = await usersCollection.findOne({ uid: userId });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Profile updated successfully',
        profile: {
          displayName: updatedUser?.displayName,
          photoURL: updatedUser?.photoURL
        }
      })
    };

  } catch (error) {
    console.error('Error updating user profile:', error);
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