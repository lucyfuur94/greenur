import { Handler } from '@netlify/functions'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

interface Plant {
  _id: number | string;
  common_name: string;
  scientific_name: string;
  plant_type: string;
  default_image_url: string;
  names_in_languages: Record<string, string>;
  last_updated: string;
}

interface PlantUpdate {
  scientific_name?: string;
  plant_type?: string;
  default_image_url?: string;
  names_in_languages?: Record<string, string>;
}

export const handler: Handler = async (event) => {
  // Only allow PUT requests
  if (event.httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  let client: MongoClient | null = null

  try {
    const { id } = event.queryStringParameters || {}
    const updates: PlantUpdate = JSON.parse(event.body || '{}')
    
    if (!id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Plant ID is required' }),
      }
    }

    // Connect to MongoDB
    client = new MongoClient(MONGO_URI!)
    await client.connect()

    const db = client.db(DB_NAME)
    const collection = db.collection<Plant>('plant_basics')

    // Add last_updated timestamp
    const updateData = {
      ...updates,
      last_updated: new Date().toISOString()
    }

    // Try to find the plant first to determine the ID type
    const plant = await collection.findOne({ 
      $or: [
        { _id: id }, // Try string ID
        { _id: parseInt(id, 10) } // Try numeric ID
      ]
    });

    if (!plant) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Plant not found' })
      }
    }

    // Update using the correct ID type
    const result = await collection.updateOne(
      { _id: plant._id },
      { $set: updateData }
    )

    if (result.matchedCount === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Plant not found' }),
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'PUT',
      },
      body: JSON.stringify({
        message: 'Plant updated successfully',
        updates: updateData,
        plantId: plant._id
      }),
    }
  } catch (error) {
    console.error('Error updating plant:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to update plant' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
} 