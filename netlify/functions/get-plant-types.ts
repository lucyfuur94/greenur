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

  let client: MongoClient | null = null

  try {
    // Connect to MongoDB
    client = new MongoClient(MONGO_URI!)
    await client.connect()

    const db = client.db(DB_NAME)
    const collection = db.collection('plant_basics')

    // Get unique plant types
    const plantTypes = await collection.distinct('plant_type')
    
    // Filter out null or empty values and sort alphabetically
    const validPlantTypes = plantTypes
      .filter(type => type && type.trim() !== '')
      .sort()

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
      },
      body: JSON.stringify({
        types: validPlantTypes,
      }),
    }
  } catch (error) {
    console.error('Error fetching plant types:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch plant types' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
}

export { handler } 