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
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    }
  }

  // Get keywords from query parameters
  const keywordsParam = event.queryStringParameters?.keywords
  if (!keywordsParam) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing keywords parameter' }),
    }
  }

  // Parse keywords
  const keywords = keywordsParam.split(',').map(k => k.trim().toLowerCase())
  
  // Get limit from query parameters (default to 5)
  const limitParam = event.queryStringParameters?.limit
  const limit = limitParam ? parseInt(limitParam, 10) : 5
  
  // Connect to MongoDB
  let client: MongoClient | null = null
  try {
    client = new MongoClient(MONGO_URI || '')
    await client.connect()
    
    const db = client.db(DB_NAME)
    const collection = db.collection('mini_articles')
    
    // Find articles that match any of the keywords
    // Sort by relevance (number of matching keywords) and then by views
    const articles = await collection.aggregate([
      {
        $match: {
          keywords: { $in: keywords }
        }
      },
      {
        $addFields: {
          matchCount: {
            $size: {
              $setIntersection: ["$keywords", keywords]
            }
          }
        }
      },
      {
        $sort: {
          matchCount: -1,
          views: -1,
          likes: -1,
          updatedAt: -1
        }
      },
      {
        $limit: limit
      },
      {
        $project: {
          _id: { $toString: "$_id" },
          title: 1,
          content: 1,
          keywords: 1,
          createdAt: 1,
          updatedAt: 1,
          views: 1,
          likes: 1,
          matchCount: 1
        }
      }
    ]).toArray()
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        articles
      }),
    }
  } catch (error) {
    console.error('Error getting articles by keywords:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get articles' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
}

export { handler } 