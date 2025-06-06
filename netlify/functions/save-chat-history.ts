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

interface ChatSession {
  _id?: ObjectId;
  userId: string;
  messages: Message[];
  startedAt: Date;
  lastUpdatedAt: Date;
  pageContext?: any;
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
  let chatSession: Omit<ChatSession, '_id'>
  try {
    chatSession = JSON.parse(event.body || '{}')
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request body' }),
    }
  }

  // Validate required fields
  if (!chatSession.userId || !chatSession.messages || !Array.isArray(chatSession.messages)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' }),
    }
  }

  // Set timestamps if not provided
  if (!chatSession.startedAt) {
    chatSession.startedAt = new Date()
  }
  if (!chatSession.lastUpdatedAt) {
    chatSession.lastUpdatedAt = new Date()
  }

  // Connect to MongoDB
  let client: MongoClient | null = null
  try {
    client = new MongoClient(MONGO_URI || '')
    await client.connect()
    
    const db = client.db(DB_NAME)
    const collection = db.collection('chat_history')
    
    // Insert the chat session
    const result = await collection.insertOne(chatSession)
    
    return {
      statusCode: 201,
      body: JSON.stringify({ 
        success: true, 
        sessionId: result.insertedId.toString() 
      }),
    }
  } catch (error) {
    console.error('Error saving chat history:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to save chat history' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
}

export { handler } 