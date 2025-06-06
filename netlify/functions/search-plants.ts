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
    const { q: query = '', page = '1', limit = '10' } = event.queryStringParameters || {}
    
    if (!query.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Search query is required' }),
      }
    }

    // Connect to MongoDB
    client = new MongoClient(MONGO_URI!)
    await client.connect()

    const db = client.db(DB_NAME)
    const collection = db.collection('plant_basics')

    // Check if query contains multiple interests (comma-separated)
    const interests = query.split(',').map(q => q.trim()).filter(q => q)
    
    // Create search query
    let searchQuery = {}
    
    if (interests.length > 1) {
      // If multiple interests, use $or to match any of them
      searchQuery = {
        $or: interests.map(interest => ({
          $or: [
            { common_name: { $regex: interest, $options: 'i' } },
            { plant_type: { $regex: interest, $options: 'i' } }
          ]
        }))
      }
    } else {
      // Single interest query
      searchQuery = {
        $or: [
          { common_name: { $regex: query, $options: 'i' } },
          { plant_type: { $regex: query, $options: 'i' } }
        ]
      }
    }

    // Get total count for pagination
    const total = await collection.countDocuments(searchQuery)

    // Parse pagination parameters
    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    // Get paginated results
    const plants = await collection
      .find(searchQuery)
      .sort({ common_name: 1 })
      .skip(skip)
      .limit(limitNum)
      .toArray()

    // Format results to match the expected structure
    const results = plants.map(plant => ({
      id: plant._id.toString(),
      name: plant.common_name,
      type: plant.plant_type,
      scientificName: plant.scientific_name,
      image: plant.default_image_url,
      displayName: plant.common_name,
      matchedTerm: query,
      taxon_photos: [{
        url: plant.default_image_url
      }]
    }))

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
      },
      body: JSON.stringify({
        total,
        page: pageNum,
        limit: limitNum,
        results,
      }),
    }
  } catch (error) {
    console.error('Error searching plants:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to search plants' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
}

export { handler } 