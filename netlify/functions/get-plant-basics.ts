import { Handler } from '@netlify/functions'
import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

interface Plant {
  _id: string | ObjectId; // MongoDB ObjectId
  id?: number; // Optional numeric ID
  common_name: string;
  scientific_name: string;
  plant_type: string;
  default_image_url: string;
  names_in_languages: Record<string, string>;
  last_updated: string;
  care?: {
    light_requirement: string;
    water_requirement: string;
    soil_type: string;
    suitable_temperature: string;
    fertilizer: string;
    common_diseases: string[];
  };
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
      // Try to find plant by id in multiple formats: ObjectId, string, or number
      let query;
      
      // Check if it's a valid ObjectId format
      if (ObjectId.isValid(id)) {
        query = {
          $or: [
            { _id: new ObjectId(id) }, // Try ObjectId in _id field
            { _id: id }, // Try string ID in _id field
            { id: parseInt(id) || 0 } // Try numeric ID in id field
          ]
        };
      } else {
        const numericId = parseInt(id);
        query = {
          $or: [
            { _id: id }, // Try string ID in _id field
            ...(numericId ? [{ id: numericId }] : []) // Try numeric ID in id field if valid
          ]
        };
      }
      
      const plant = await collection.findOne(query)
      
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