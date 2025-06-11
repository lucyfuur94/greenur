import { Handler } from '@netlify/functions'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import { extract_plant_info } from './utils/plant/plantUtils'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

const handler: Handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  let client: MongoClient | null = null

  try {
    const { plantName } = JSON.parse(event.body || '{}')
    
    if (!plantName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Plant name is required' }),
      }
    }

    // Connect to MongoDB
    client = new MongoClient(MONGO_URI!)
    await client.connect()

    const db = client.db(DB_NAME)
    const collection = db.collection('plant_basics')

    // Check if plant already exists
    const existingPlant = await collection.findOne({
      common_name: { $regex: new RegExp(`^${plantName}$`, 'i') }
    })

    if (existingPlant) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Plant already exists in catalog' }),
      }
    }

    // Get next available ID by counting documents
    const totalDocs = await collection.countDocuments()
    const nextId = totalDocs + 1

    // Extract plant information
    const plantInfo = await extract_plant_info(nextId, plantName)

    // Remove the _id field and let MongoDB generate it
    const { _id, ...documentToInsert } = plantInfo

    // Insert new plant
    await collection.insertOne(documentToInsert)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST',
      },
      body: JSON.stringify(documentToInsert),
    }
  } catch (error) {
    console.error('Error adding plant:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to add plant' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
}

export { handler } 