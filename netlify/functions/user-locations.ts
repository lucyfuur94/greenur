import { Handler } from '@netlify/functions'
import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

interface Location {
  _id?: string | ObjectId;
  userId: string;
  type: 'home' | 'work' | 'other';
  name: string;
  address: string;
  lat: number;
  lon: number;
  createdAt: string;
}

export const handler: Handler = async (event) => {
  let client: MongoClient | null = null

  try {
    // Connect to MongoDB
    client = new MongoClient(MONGO_URI!)
    await client.connect()

    const db = client.db(DB_NAME)
    const collection = db.collection<Location>('user_locations')

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case 'POST': {
        // Add a new location
        const locationData: Location = JSON.parse(event.body || '{}')
        
        if (!locationData.userId || !locationData.name || !locationData.lat || !locationData.lon) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing required fields' })
          }
        }

        // Check for duplicate location
        const existingLocation = await collection.findOne({
          userId: locationData.userId,
          lat: locationData.lat,
          lon: locationData.lon
        })

        if (existingLocation) {
          return {
            statusCode: 200,
            body: JSON.stringify({ 
              message: 'Location already exists',
              locationId: existingLocation._id
            })
          }
        }

        // Add timestamp
        const locationToAdd = {
          ...locationData,
          createdAt: new Date().toISOString()
        }

        const result = await collection.insertOne(locationToAdd)
        return {
          statusCode: 201,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
          },
          body: JSON.stringify({
            message: 'Location added successfully',
            locationId: result.insertedId
          })
        }
      }

      case 'GET': {
        const { userId } = event.queryStringParameters || {}
        
        if (!userId) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'userId is required' })
          }
        }

        // Get user's locations
        const locations = await collection
          .find({ userId })
          .sort({ createdAt: -1 })
          .toArray()

        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
          },
          body: JSON.stringify({ locations })
        }
      }

      case 'DELETE': {
        const { id } = event.queryStringParameters || {}
        
        if (!id) {
          return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Location ID is required' })
          }
        }

        const result = await collection.deleteOne({ 
          _id: new ObjectId(id)
        })

        if (result.deletedCount === 0) {
          return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Location not found' })
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
            message: 'Location deleted successfully'
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
    console.error('Error handling user locations:', error)
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