import { Handler } from '@netlify/functions'
import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'
import { verifyAuthToken } from './utils/firebaseAdmin'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface TrackedPlant {
  _id?: string | ObjectId;
  userId: string;
  nickname: string;
  plantId: string | number;
  currentImage: string;
  dateAdded: string;
  lastWatered?: string;
  notes?: string;
  healthStatus?: 'healthy' | 'needs_attention' | 'unhealthy';
  plantDetails: {
    common_name: string;
    scientific_name: string;
    plant_type: string;
  };
  imageHistory: Array<{
    url: string;
    timestamp: string;
    analysis?: any;
  }>;
  growingSpaceId?: string | null;
}

export const handler: Handler = async (event, context) => {
  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  let client: MongoClient | null = null

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 204,
        headers: corsHeaders,
        body: '',
      }
    }

    // Only allow POST requests for this function
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Method not allowed' }),
      }
    }

    // Verify authentication
    const authHeader = event.headers.authorization
    const authorizedUserId = await verifyAuthToken(authHeader)
    
    if (!authorizedUserId) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized: Invalid or missing authentication token' })
      }
    }

    const { plantId, imageUrl, timestamp, action } = JSON.parse(event.body || '{}')
    
    if (!plantId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Plant ID is required' }),
      }
    }

    // Connect to MongoDB
    client = new MongoClient(MONGO_URI!)
    await client.connect()

    const db = client.db(DB_NAME)
    const collection = db.collection<TrackedPlant>('user_plants')

    // Verify ownership
    const plant = await collection.findOne({ 
      _id: new ObjectId(plantId),
      userId: authorizedUserId 
    })

    if (!plant) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Plant not found or access denied' })
      }
    }

    let updateOperation;

    switch (action) {
      case 'add_image': {
        if (!imageUrl) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Image URL is required for add_image action' })
          }
        }

        updateOperation = {
          $set: { 
            currentImage: imageUrl,
            lastUpdated: new Date().toISOString()
          },
          $push: {
            imageHistory: {
              url: imageUrl,
              timestamp: new Date().toISOString()
            }
          }
        }
        break;
      }

      case 'remove_image': {
        if (!imageUrl || !timestamp) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Image URL and timestamp are required for remove_image action' })
          }
        }

        // Remove the specific image from history
        updateOperation = {
          $pull: {
            imageHistory: {
              url: imageUrl,
              timestamp: timestamp
            }
          },
          $set: {
            lastUpdated: new Date().toISOString()
          }
        }

        // After removing, check if we need to update currentImage
        const updatedImageHistory = plant.imageHistory.filter(item => 
          !(item.url === imageUrl && item.timestamp === timestamp)
        )

        // If the removed image was the current image, update to the latest remaining image
        if (plant.currentImage === imageUrl && updatedImageHistory.length > 0) {
          const latestImage = updatedImageHistory[updatedImageHistory.length - 1]
          updateOperation.$set.currentImage = latestImage.url
        }
        break;
      }

      default: {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Invalid action. Supported actions: add_image, remove_image' })
        }
      }
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(plantId) },
      updateOperation
    )

    if (result.matchedCount === 0) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Plant not found' }),
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: `Image ${action === 'add_image' ? 'added' : 'removed'} successfully`,
        action: action
      }),
    }
  } catch (error) {
    console.error('Error updating plant:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update plant' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
} 