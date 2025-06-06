import { Handler } from '@netlify/functions'
import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

interface UpdateChatRequest {
  sessionId: string;
  messages: Message[];
  pageContext?: any;
  lastUpdatedAt: Date;
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
  let updateRequest: UpdateChatRequest
  try {
    updateRequest = JSON.parse(event.body || '{}')
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request body' }),
    }
  }

  // Validate required fields
  if (!updateRequest.sessionId || !updateRequest.messages || !Array.isArray(updateRequest.messages)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' }),
    }
  }

  // Connect to MongoDB
  let client: MongoClient | null = null
  try {
    client = new MongoClient(MONGO_URI || '')
    await client.connect()
    
    const db = client.db(DB_NAME)
    const collection = db.collection('chat_history')
    
    // Update the chat session
    const result = await collection.updateOne(
      { _id: new ObjectId(updateRequest.sessionId) },
      { 
        $set: { 
          messages: updateRequest.messages,
          lastUpdatedAt: new Date(updateRequest.lastUpdatedAt),
          ...(updateRequest.pageContext ? { pageContext: updateRequest.pageContext } : {})
        } 
      }
    )
    
    if (result.matchedCount === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Chat session not found' }),
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        updated: result.modifiedCount > 0
      }),
    }
  } catch (error) {
    console.error('Error updating chat history:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to update chat history' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
}

export { handler } 