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

  // Get userId from query parameters
  const userId = event.queryStringParameters?.userId
  if (!userId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing userId parameter' }),
    }
  }
  
  // Get limit from query parameters (default to 5)
  const limitParam = event.queryStringParameters?.limit
  const limit = limitParam ? parseInt(limitParam, 10) : 5
  
  // Connect to MongoDB
  let client: MongoClient | null = null
  try {
    client = new MongoClient(MONGO_URI || '')
    await client.connect()
    
    const db = client.db(DB_NAME)
    const profileCollection = db.collection('user_keyword_profiles')
    const articleCollection = db.collection('mini_articles')
    
    // Get user's keyword profile
    const profile = await profileCollection.findOne({ userId })
    
    if (!profile || !profile.keywords || profile.keywords.length === 0) {
      // If no profile or keywords, return popular articles instead
      const popularArticles = await articleCollection
        .find({})
        .sort({ views: -1, likes: -1 })
        .limit(limit)
        .toArray()
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true,
          articles: popularArticles.map(article => ({
            ...article,
            _id: article._id.toString()
          })),
          source: 'popular'
        }),
      }
    }
    
    // Extract keywords and sort by weight (most important first)
    const sortedKeywords = [...profile.keywords]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 10) // Use top 10 keywords
      .map(k => k.keyword)
    
    // Find articles that match any of the user's keywords
    const articles = await articleCollection.aggregate([
      {
        $match: {
          keywords: { $in: sortedKeywords }
        }
      },
      {
        $addFields: {
          matchCount: {
            $size: {
              $setIntersection: ["$keywords", sortedKeywords]
            }
          },
          // Calculate a relevance score based on keyword matches and popularity
          relevanceScore: {
            $add: [
              { 
                $multiply: [
                  { 
                    $size: { 
                      $setIntersection: ["$keywords", sortedKeywords] 
                    } 
                  }, 
                  10 // Weight for keyword matches
                ] 
              },
              { $divide: ["$views", 10] }, // Weight for views
              { $multiply: ["$likes", 2] }  // Weight for likes
            ]
          }
        }
      },
      {
        $sort: {
          relevanceScore: -1,
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
          matchCount: 1,
          relevanceScore: 1
        }
      }
    ]).toArray()
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        articles,
        source: 'personalized',
        userKeywords: sortedKeywords
      }),
    }
  } catch (error) {
    console.error('Error getting recommended articles:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get recommended articles' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
}

export { handler } 