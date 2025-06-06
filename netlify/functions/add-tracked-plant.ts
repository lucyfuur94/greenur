import { Handler } from '@netlify/functions'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

interface TrackedPlant {
  userId: string;
  nickname: string;
  plantId: string;
  currentImage: string;
  dateAdded: string;
  healthStatus: string;
  plantDetails: {
    common_name: string;
    scientific_name: string;
    plant_type: string;
  };
}

const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  // Parse request body
  let plantData;
  try {
    plantData = JSON.parse(event.body || '')
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request body' }),
    }
  }

  // Validate required fields
  if (!plantData.userId || !plantData.plantDetails) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' }),
    }
  }

  let client: MongoClient | null = null

  try {
    // Connect to MongoDB
    if (!MONGO_URI) {
      throw new Error('MongoDB URI is not defined')
    }
    client = await MongoClient.connect(MONGO_URI)
    const db = client.db(DB_NAME)

    // Add timestamps
    const now = new Date().toISOString()
    const plantToAdd = {
      ...plantData,
      dateAdded: now,
      lastUpdated: now,
    }

    // Insert into user_plants collection
    const result = await db.collection('user_plants').insertOne(plantToAdd)

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST',
      },
      body: JSON.stringify({
        message: 'Plant added successfully',
        plantId: result.insertedId,
      }),
    }
  } catch (error) {
    console.error('Error adding tracked plant:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to add tracked plant' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
}

export { handler } 