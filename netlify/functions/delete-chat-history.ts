import { Handler } from '@netlify/functions'
import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

const handler: Handler = async (event, context) => {
  // Only allow DELETE requests
  if (event.httpMethod !== 'DELETE') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    }
  }

  // Get sessionId from query parameters
  const sessionId = event.queryStringParameters?.sessionId
  if (!sessionId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing sessionId parameter' }),
    }
  }

  // Connect to MongoDB
  let client: MongoClient | null = null
  try {
    client = new MongoClient(MONGO_URI || '')
    await client.connect()
    
    const db = client.db(DB_NAME)
    const collection = db.collection('chat_history')
    
    // Delete the chat session
    const result = await collection.deleteOne({ _id: new ObjectId(sessionId) })
    
    if (result.deletedCount === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Chat session not found' }),
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        deleted: true
      }),
    }
  } catch (error) {
    console.error('Error deleting chat history:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to delete chat history' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
}

export { handler } 