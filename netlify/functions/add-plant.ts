import { Handler } from '@netlify/functions'
import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'
import { extract_plant_info } from '../functions/analyze-plant/utils/plantUtils'

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
    const { plantName, scientific_name, plant_type } = JSON.parse(event.body || '{}')
    
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

    // Generate a new ObjectId for the plant
    const plantId = new ObjectId()

    // Create plant information using the data from Gemini analysis
    const plantInfo = {
      _id: plantId,
      common_name: plantName,
      scientific_name: scientific_name || '',
      plant_type: plant_type || '',
      names_in_languages: {},
      default_image_url: '',
      last_updated: new Date().toISOString()
    }

    // Insert new plant
    await collection.insertOne(plantInfo)

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST',
      },
      body: JSON.stringify(plantInfo),
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