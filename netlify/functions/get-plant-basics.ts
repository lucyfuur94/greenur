import { Handler } from '@netlify/functions'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

interface Plant {
  _id: string | number;
  common_name: string;
  scientific_name: string;
  plant_type: string;
  default_image_url: string;
  names_in_languages: Record<string, string>;
  last_updated: string;
}

const handler: Handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  let client: MongoClient | null = null

  try {
    // Connect to MongoDB
    client = new MongoClient(MONGO_URI!)
    await client.connect()

    const db = client.db(DB_NAME)
    const collection = db.collection<Plant>('plant_basics')

    // Check if id is provided in query parameters
    const { id } = event.queryStringParameters || {}
    
    if (id) {
      // Try to find plant by id as either string or number
      const plant = await collection.findOne({ 
        $or: [
          { _id: id }, // Try string ID first
          { _id: parseInt(id) } // Then try numeric ID
        ]
      })
      
      if (!plant) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: 'Plant not found' }),
        }
      }

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          // Add CORS headers
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET',
        },
        body: JSON.stringify(plant),
      }
    }

    // If no id provided, get all plants sorted by common_name
    const plants = await collection
      .find({})
      .sort({ common_name: 1 })
      .toArray()

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // Add CORS headers
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
      },
      body: JSON.stringify(plants),
    }
  } catch (error) {
    console.error('Error fetching plants:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch plants' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
}

export { handler } 