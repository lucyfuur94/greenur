import { Handler } from '@netlify/functions'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

const handler: Handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  // Get plant name from query parameters
  const plantName = event.queryStringParameters?.name

  if (!plantName) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Plant name is required' }),
    }
  }

  let client: MongoClient | null = null

  try {
    // Connect to MongoDB
    client = new MongoClient(MONGO_URI!)
    await client.connect()

    const db = client.db(DB_NAME)
    const collection = db.collection('plant_basics')

    // Check if plant exists
    const existingPlant = await collection.findOne({
      common_name: { $regex: new RegExp(`^${plantName}$`, 'i') }
    })

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
      },
      body: JSON.stringify({ 
        exists: !!existingPlant,
        plant: existingPlant ? {
          id: existingPlant._id,
          common_name: existingPlant.common_name,
          scientific_name: existingPlant.scientific_name,
          plant_type: existingPlant.plant_type
        } : null
      }),
    }
  } catch (error) {
    console.error('Error checking plant:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to check plant' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
}

export { handler } 