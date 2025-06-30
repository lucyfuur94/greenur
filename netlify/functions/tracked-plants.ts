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

    // Verify authentication for all methods
    const authHeader = event.headers.authorization
    const authorizedUserId = await verifyAuthToken(authHeader)
    
    if (!authorizedUserId) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized: Invalid or missing authentication token' })
      }
    }

    // Connect to MongoDB
    client = new MongoClient(MONGO_URI!)
    await client.connect()

    const db = client.db(DB_NAME)
    const collection = db.collection<TrackedPlant>('user_plants')

    const method = event.httpMethod

    // Handle different HTTP methods
    switch (method) {
      case 'POST': {
        // Add a new tracked plant
        const plantData: TrackedPlant = JSON.parse(event.body || '{}')
        
        // Ensure the userId matches the authenticated user
        if (plantData.userId !== authorizedUserId) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Forbidden: userId mismatch' })
          }
        }
        
        // Validate required fields
        if (!plantData.userId || !plantData.nickname || !plantData.plantId || !plantData.currentImage) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Missing required fields' })
          }
        }

        // Add dateAdded and initialize image history if not provided
        const now = new Date().toISOString()
        const plantToAdd = {
          ...plantData,
          dateAdded: now,
          lastUpdated: now,
          healthStatus: plantData.healthStatus || 'healthy',
          imageHistory: plantData.imageHistory || [{
            url: plantData.currentImage,
            timestamp: now
          }]
        }

        const result = await collection.insertOne(plantToAdd)
        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Plant added successfully',
            plantId: result.insertedId.toString(), // Return the unique user plant instance ID
            userPlantId: result.insertedId.toString(), // Also provide as userPlantId for clarity
            plantTypeId: plantToAdd.plantId // And provide the plant type ID separately
          })
        }
      }

      case 'GET': {
        const userId = event.queryStringParameters?.userId
        const id = event.queryStringParameters?.id
        
        // If id is provided, fetch single plant
        if (id) {
          let plant;
          
          // Only look up by MongoDB ObjectId (user's plant instance)
          if (ObjectId.isValid(id)) {
            plant = await collection.findOne({ 
              _id: new ObjectId(id),
              userId: authorizedUserId // Ensure user owns the plant
            });
          }
          
          if (!plant) {
            return {
              statusCode: 404,
              headers: corsHeaders,
              body: JSON.stringify({ error: 'Plant not found or access denied' })
            }
          }

          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(plant)
          }
        }
        
        // If userId is provided, fetch all plants for user
        if (userId) {
          const plants = await collection
            .find({ userId })
            .sort({ dateAdded: -1 })
            .toArray()

          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(plants)
          }
        }

        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Either userId or id parameter is required' })
        }
      }

      case 'PUT': {
        // Update a tracked plant
        const id = event.queryStringParameters?.id
        const updates = JSON.parse(event.body || '{}')
        
        if (!id) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Plant ID is required' })
          }
        }

        // Verify ownership before updating
        const existingPlant = await collection.findOne({ _id: new ObjectId(id) })
        if (!existingPlant) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Plant not found' })
          }
        }

        if (existingPlant.userId !== authorizedUserId) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Forbidden: Cannot update another user\'s plant' })
          }
        }

        console.log('Received update data:', JSON.stringify(updates))

        // Handle the update based on the structure
        let updateOperation;
        
        if (updates.$set) {
          // Handle MongoDB update format with $set operator
          updateOperation = updates;
        } else if (updates.currentImage) {
          // If updating current image, add to image history
          updateOperation = {
            $set: updates,
            $push: {
              imageHistory: {
                url: updates.currentImage,
                timestamp: new Date().toISOString()
              }
            }
          };
        } else {
          // Simple update with just $set
          updateOperation = { $set: updates };
        }

        console.log('Update operation:', JSON.stringify(updateOperation))

        try {
          const result = await collection.updateOne(
            { _id: new ObjectId(id) },
            updateOperation
          )

          if (result.matchedCount === 0) {
            return {
              statusCode: 404,
              headers: corsHeaders,
              body: JSON.stringify({ error: 'Plant not found' })
            }
          }

          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
              message: 'Plant updated successfully'
            })
          }
        } catch (error) {
          console.error('Error updating plant:', error)
          return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: `Error updating plant: ${error.message}` })
          }
        }
      }

      case 'DELETE': {
        // Delete a tracked plant and its checkup history
        const id = event.queryStringParameters?.id
        
        if (!id) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Plant ID is required' })
          }
        }

        // Verify ownership before deleting
        const existingPlant = await collection.findOne({ _id: new ObjectId(id) })
        if (!existingPlant) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Plant not found' })
          }
        }

        if (existingPlant.userId !== authorizedUserId) {
          return {
            statusCode: 403,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Forbidden: Cannot delete another user\'s plant' })
          }
        }

        // Delete plant checkups first
        await db.collection('plant_checkups').deleteMany({
          plantId: id
        })

        // Then delete the plant
        const result = await collection.deleteOne({ _id: new ObjectId(id) })

        if (result.deletedCount === 0) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Plant not found' })
          }
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'Plant deleted successfully'
          })
        }
      }

      default:
        return {
          statusCode: 405,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Method not allowed' })
        }
    }
  } catch (error) {
    console.error('Error in tracked-plants function:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
} 