import { Handler } from '@netlify/functions'
import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

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
  let client: MongoClient | null = null

  try {
    // Connect to MongoDB
    client = new MongoClient(MONGO_URI!)
    await client.connect()

    const db = client.db(DB_NAME)
    const collection = db.collection<TrackedPlant>('user_plants')

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'POST': {
        // Add a new tracked plant
        const plantData: TrackedPlant = JSON.parse(event.body || '{}')
        
        // Validate required fields
        if (!plantData.userId || !plantData.nickname || !plantData.plantId || !plantData.currentImage) {
          return {
            statusCode: 400,
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
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
          },
          body: JSON.stringify({
            message: 'Plant added successfully',
            plantId: result.insertedId
          })
        }
      }

      case 'GET': {
        const { userId, id } = event.queryStringParameters || {}
        
        // If id is provided, fetch single plant
        if (id) {
          const plant = await collection.findOne({ _id: new ObjectId(id) })
          
          if (!plant) {
            return {
              statusCode: 404,
              body: JSON.stringify({ error: 'Plant not found' })
            }
          }

          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
            },
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
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
            },
            body: JSON.stringify(plants)
          }
        }

        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Either userId or id parameter is required' })
        }
      }

      case 'PUT': {
        // Update a tracked plant
        const { id } = event.queryStringParameters || {}
        const updates = JSON.parse(event.body || '{}')
        
        if (!id) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Plant ID is required' })
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
              body: JSON.stringify({ error: 'Plant not found' })
            }
          }

          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Content-Type',
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
            },
            body: JSON.stringify({
              message: 'Plant updated successfully'
            })
          }
        } catch (error) {
          console.error('Error updating plant:', error)
          return {
            statusCode: 500,
            body: JSON.stringify({ error: `Error updating plant: ${error.message}` })
          }
        }
      }

      case 'DELETE': {
        // Delete a tracked plant and its checkup history
        const { id } = event.queryStringParameters || {}
        
        if (!id) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Plant ID is required' })
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
            body: JSON.stringify({ error: 'Plant not found' })
          }
        }

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
          },
          body: JSON.stringify({
            message: 'Plant and its history deleted successfully'
          })
        }
      }

      default:
        return {
          statusCode: 405,
          body: JSON.stringify({ error: 'Method not allowed' })
        }
    }
  } catch (error) {
    console.error('Error handling tracked plants:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
} 