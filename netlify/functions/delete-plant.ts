import { Handler } from '@netlify/functions'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

const handler: Handler = async (event, context) => {
  // Only allow DELETE requests
  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  let client: MongoClient | null = null

  try {
    const plantId = event.queryStringParameters?.id
    
    if (!plantId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Plant ID is required' }),
      }
    }

    // Connect to MongoDB
    client = new MongoClient(MONGO_URI!)
    await client.connect()

    const db = client.db(DB_NAME)
    const collection = db.collection('plant_basics')

    // Delete the plant using string ID
    const result = await collection.deleteOne({
      _id: plantId.toString()
    })

    if (result.deletedCount === 0) {
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
        'Access-Control-Allow-Methods': 'DELETE',
      },
      body: JSON.stringify({
        message: 'Plant deleted successfully',
        plantId
      }),
    }
  } catch (error) {
    console.error('Error deleting plant:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to delete plant' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
}

export { handler } 