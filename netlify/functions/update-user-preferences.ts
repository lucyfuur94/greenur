import { Handler } from '@netlify/functions'
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb'
import { verifyAuthToken } from './utils/firebaseAdmin'

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

interface UserPreferences {
  // Gardening preferences
  experience?: 'beginner' | 'intermediate' | 'expert';
  gardenType?: 'indoor' | 'outdoor' | 'both';
  interests?: string[];
  
  // Plant checkup preferences
  preferredCheckupDays?: ('saturday' | 'sunday')[];
  checkupFrequency?: 1 | 2 | 3 | 4;
  
  // Notification settings
  notifications?: {
    email: boolean;
    push: boolean;
  } | boolean;
  
  // Location data
  location?: {
    latitude: number;
    longitude: number;
    city?: string;
    country?: string;
    timezone: string;
  };
  
  // Admin settings
  isAdmin?: boolean;
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
} as const;

// Create a MongoDB client outside the handler to enable connection reuse
let cachedClient: MongoClient | null = null;

async function connectToDatabase(): Promise<MongoClient> {
  // Check if we have a cached client
  if (cachedClient) {
    try {
      // Test if the connection is still valid with a simple command
      await cachedClient.db().command({ ping: 1 });
      console.log('Using cached MongoDB connection');
      return cachedClient;
    } catch (error) {
      console.log('Cached MongoDB connection is no longer valid, creating a new one');
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

  console.log('Creating new MongoDB connection...');
  
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
    console.log('MongoDB connection established successfully');
    
    // Save connection in cache
    cachedClient = client;
    return client;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export const handler: Handler = async (event, context) => {
  // Disable waiting for empty event loop to prevent timeouts
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  console.time('Total function execution time');
  
  let client: MongoClient | null = null;

  try {
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: corsHeaders,
        body: ''
      };
    }
    
    console.time('Auth verification time');
    // Verify Firebase auth token
    const userId = event.queryStringParameters?.userId;
    const authHeader = event.headers.authorization;
    
    let authorizedUserId: string | null = null;
    
    // If authorization header is present, verify it
    if (authHeader) {
      authorizedUserId = await verifyAuthToken(authHeader);
      console.log('Auth verification result:', { authorizedUserId, requestedUserId: userId });
      
      // If auth verification succeeded but user IDs don't match
      if (authorizedUserId && userId && authorizedUserId !== userId) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Unauthorized: User ID mismatch' })
        };
      }
    }
    console.timeEnd('Auth verification time');
    
    // Use authorized user ID if available, otherwise fall back to query param
    const effectiveUserId = authorizedUserId || userId;
    
    if (!effectiveUserId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'User ID is required' })
      };
    }
    
    // Connect to MongoDB
    console.time('MongoDB connection time');
    try {
      client = await connectToDatabase();
      console.timeEnd('MongoDB connection time');
    } catch (error) {
      console.timeEnd('MongoDB connection time');
      console.error('Failed to connect to MongoDB:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Database connection error' })
      };
    }
    
    console.time('MongoDB operation time');
    const db = client.db(DB_NAME);
    const usersCollection = db.collection('users');

    // GET - Fetch user preferences
    if (event.httpMethod === 'GET') {
      const user = await usersCollection.findOne({ uid: effectiveUserId });
      console.timeEnd('MongoDB operation time');
      
      if (!user) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'User not found' })
        };
      }

      console.timeEnd('Total function execution time');
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ preferences: user.preferences || getDefaultPreferences() })
      };
    }

    // POST - Update user preferences
    if (event.httpMethod === 'POST') {
      const preferences: Partial<UserPreferences> = JSON.parse(event.body || '{}');
      
      // Validate gardening preferences
      if (preferences.experience && 
          !['beginner', 'intermediate', 'expert'].includes(preferences.experience)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid experience level' })
        };
      }

      if (preferences.gardenType && 
          !['indoor', 'outdoor', 'both'].includes(preferences.gardenType)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid garden type' })
        };
      }

      if (preferences.interests && !Array.isArray(preferences.interests)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Interests must be an array' })
        };
      }
      
      // Validate checkup preferences
      if (preferences.preferredCheckupDays) {
        if (!Array.isArray(preferences.preferredCheckupDays) || 
            !preferences.preferredCheckupDays.every(day => ['saturday', 'sunday'].includes(day))) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Invalid preferred checkup days' })
          };
        }
      }

      if (preferences.checkupFrequency && 
          ![1, 2, 3, 4].includes(preferences.checkupFrequency)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid checkup frequency' })
        };
      }

      // Get current user preferences
      const currentPreferences = await getUserPreferences(usersCollection, effectiveUserId);
      
      // Update user preferences
      const result = await usersCollection.updateOne(
        { uid: effectiveUserId },
        { 
          $set: { 
            preferences: {
              ...currentPreferences,
              ...preferences,
              updatedAt: new Date()
            }
          }
        },
        { upsert: true }
      );

      if (result.modifiedCount === 0 && result.upsertedCount === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to update preferences' })
        };
      }

      const updatedUser = await usersCollection.findOne({ uid: effectiveUserId });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Preferences updated successfully',
          preferences: updatedUser?.preferences
        })
      };
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Error handling user preferences:', error);
    console.timeEnd('Total function execution time');
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

function getDefaultPreferences(): UserPreferences {
  return {
    experience: 'beginner',
    gardenType: 'both',
    interests: [],
    preferredCheckupDays: ['sunday'],
    checkupFrequency: 2,
    notifications: {
      email: true,
      push: true
    }
  };
}

async function getUserPreferences(collection: any, userId: string): Promise<UserPreferences> {
  const user = await collection.findOne({ uid: userId });
  return user?.preferences || getDefaultPreferences();
} 