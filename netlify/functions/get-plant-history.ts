import { Handler } from '@netlify/functions';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { MongoClient, ObjectId } from 'mongodb';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let client: MongoClient | null = null;

  try {
    // Verify Firebase token
    const authHeader = event.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'No valid authorization token provided' })
      };
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get plant ID from query parameters
    const plantId = event.queryStringParameters?.plantId;
    if (!plantId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Plant ID is required' })
      };
    }

    // Connect to MongoDB
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI environment variable is not set');
    }

    client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    const db = client.db('greenurDB');
    const collection = db.collection('trackedPlants');

    // Find the plant and return its image history
    const plant = await collection.findOne(
      { 
        _id: new ObjectId(plantId),
        userId: userId
      },
      {
        projection: {
          _id: 1,
          nickname: 1,
          plantDetails: 1,
          imageHistory: 1,
          currentImage: 1,
          dateAdded: 1
        }
      }
    );

    if (!plant) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Plant not found' })
      };
    }

    // Sort image history by timestamp (newest first)
    const imageHistory = (plant.imageHistory || []).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Get only images with analysis for history
    const analyzedImages = imageHistory.filter(image => image.analysis);

    // Get latest analysis if available
    const latestAnalysis = imageHistory.find(image => image.analysis)?.analysis || null;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        plantId: plant._id,
        nickname: plant.nickname,
        plantDetails: plant.plantDetails,
        currentImage: plant.currentImage,
        dateAdded: plant.dateAdded,
        imageHistory: imageHistory,
        analyzedImages: analyzedImages,
        latestAnalysis: latestAnalysis,
        totalImages: imageHistory.length,
        totalAnalyses: analyzedImages.length
      })
    };

  } catch (error) {
    console.error('Error fetching plant history:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to fetch plant history',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  } finally {
    if (client) {
      await client.close();
    }
  }
};

export { handler }; 