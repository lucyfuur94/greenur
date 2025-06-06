import { Handler } from '@netlify/functions'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

interface KeywordUpdateRequest {
  userId: string;
  keywords: string[];
  timestamp: string | Date;
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
  let request: KeywordUpdateRequest
  try {
    request = JSON.parse(event.body || '{}')
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request body' }),
    }
  }

  // Validate required fields
  if (!request.userId || !request.keywords || !Array.isArray(request.keywords)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields' }),
    }
  }

  // Normalize keywords (lowercase, trim)
  const normalizedKeywords = request.keywords.map(k => k.trim().toLowerCase())
  
  // Connect to MongoDB
  let client: MongoClient | null = null
  try {
    client = new MongoClient(MONGO_URI || '')
    await client.connect()
    
    const db = client.db(DB_NAME)
    const collection = db.collection('user_keyword_profiles')
    
    // Get existing profile or create a new one
    const profile = await collection.findOne({ userId: request.userId })
    
    if (profile) {
      // Update existing profile
      const existingKeywords = profile.keywords || []
      const updatedKeywords = [...existingKeywords]
      
      // Update weights for existing keywords or add new ones
      for (const keyword of normalizedKeywords) {
        const existingIndex = updatedKeywords.findIndex(k => k.keyword.toLowerCase() === keyword)
        
        if (existingIndex >= 0) {
          // Increase weight for existing keyword
          updatedKeywords[existingIndex] = {
            ...updatedKeywords[existingIndex],
            weight: updatedKeywords[existingIndex].weight + 1,
            lastUsed: new Date(request.timestamp)
          }
        } else {
          // Add new keyword
          updatedKeywords.push({
            keyword,
            weight: 1,
            lastUsed: new Date(request.timestamp)
          })
        }
      }
      
      // Update the profile
      const result = await collection.updateOne(
        { _id: profile._id },
        { 
          $set: { 
            keywords: updatedKeywords,
            updatedAt: new Date()
          } 
        }
      )
      
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true,
          updated: true,
          keywordCount: updatedKeywords.length
        }),
      }
    } else {
      // Create a new profile
      const result = await collection.insertOne({
        userId: request.userId,
        keywords: normalizedKeywords.map(keyword => ({
          keyword,
          weight: 1,
          lastUsed: new Date(request.timestamp)
        })),
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      return {
        statusCode: 201,
        body: JSON.stringify({ 
          success: true,
          created: true,
          keywordCount: normalizedKeywords.length
        }),
      }
    }
  } catch (error) {
    console.error('Error updating user keywords:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to update user keywords' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
}

export { handler } 