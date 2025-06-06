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

  // Connect to MongoDB
  let client: MongoClient | null = null
  try {
    client = new MongoClient(MONGO_URI || '')
    await client.connect()
    
    const db = client.db(DB_NAME)
    const collection = db.collection('chat_history')
    
    // Get chat sessions for the user, sorted by lastUpdatedAt in descending order
    const sessions = await collection
      .find({ userId })
      .sort({ lastUpdatedAt: -1 })
      .limit(20) // Limit to 20 most recent sessions
      .toArray()
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        sessions: sessions.map(session => ({
          ...session,
          _id: session._id.toString() // Convert ObjectId to string
        }))
      }),
    }
  } catch (error) {
    console.error('Error getting chat history:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get chat history' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
}

export { handler } 