import { Handler } from '@netlify/functions'
import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

interface InteractionRequest {
  articleId: string;
  interaction: 'view' | 'like';
  userId?: string; // Optional user ID for tracking who liked the article
}

const handler: Handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    }
  }

  // Parse the request body
  let request: InteractionRequest
  try {
    request = JSON.parse(event.body || '{}')
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request body' }),
    }
  }

  // Validate required fields
  if (!request.articleId || !request.interaction) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' }),
    }
  }

  // Validate interaction type
  if (request.interaction !== 'view' && request.interaction !== 'like') {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid interaction type' }),
    }
  }
  
  // Connect to MongoDB
  let client: MongoClient | null = null
  try {
    client = new MongoClient(MONGO_URI || '')
    await client.connect()
    
    const db = client.db(DB_NAME)
    const collection = db.collection('mini_articles')
    
    // Update the article based on interaction type
    const updateField = request.interaction === 'view' ? 'views' : 'likes'
    
    // Update the article
    const result = await collection.updateOne(
      { _id: new ObjectId(request.articleId) },
      { $inc: { [updateField]: 1 } }
    )
    
    if (result.matchedCount === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Article not found' }),
      }
    }
    
    // If this is a like and we have a userId, record who liked it
    if (request.interaction === 'like' && request.userId) {
      // Record the like in a separate collection for user-article interactions
      const interactionsCollection = db.collection('user_article_interactions')
      
      await interactionsCollection.updateOne(
        { 
          userId: request.userId,
          articleId: request.articleId
        },
        { 
          $set: { 
            liked: true,
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
      )
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        updated: result.modifiedCount > 0,
        interaction: request.interaction
      }),
    }
  } catch (error) {
    console.error('Error recording article interaction:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to record article interaction' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
}

export { handler } 