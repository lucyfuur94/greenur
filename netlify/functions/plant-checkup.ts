import { Handler, HandlerEvent } from '@netlify/functions'
import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'
import OpenAI from 'openai'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY
})

interface CheckupResult {
  stage: string;
  concerns: string[];
  carePlan: string[];
  nextCheckupDate: string;
  todoItems: string[];
}

interface PlantCheckup {
  plantId: string;
  userId: string;
  date: string;
  imageUrl: string;
  checkupResult: CheckupResult;
  completedTodos?: string[];
  growthAnalysis?: {
    rate: string;
    changes: string[];
  };
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (!event.httpMethod || !['POST', 'GET'].includes(event.httpMethod)) {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  let client: MongoClient | null = null

  try {
    client = await MongoClient.connect(MONGO_URI!)
    const db = client.db(DB_NAME)
    const checkupsCollection = db.collection<PlantCheckup>('plant_checkups')

    // GET - Fetch checkups for a plant
    if (event.httpMethod === 'GET') {
      const { plantId } = event.queryStringParameters || {}
      
      if (!plantId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Plant ID is required' })
        }
      }

      const checkups = await checkupsCollection
        .find({ plantId })
        .sort({ date: -1 })
        .toArray()

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ checkups })
      }
    }

    // POST - Create a new checkup
    if (event.httpMethod === 'POST') {
      const { plantId, userId, imageUrl, previousImageUrl } = JSON.parse(event.body || '{}')

      if (!plantId || !userId || !imageUrl) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing required fields' })
        }
      }

      // Prepare prompt for GPT-4 Vision
      let prompt = `Analyze this plant image and provide:
1. Current growth stage
2. Any concerning issues or problems
3. Detailed care plan for the next period
4. Specific tasks the owner should complete before next checkup`

      // If we have a previous image, add comparison request
      if (previousImageUrl) {
        prompt += `\n5. Compare with the previous image and analyze:
- Growth rate
- Notable changes
- Areas of improvement or concern`
      }

      // Call GPT-4 Vision for analysis
      const messages = [
        {
          role: "user" as const,
          content: prompt
        },
        {
          role: "user" as const,
          content: "Here is the current plant image: " + imageUrl
        }
      ]

      if (previousImageUrl) {
        messages.push({
          role: "user" as const,
          content: "Here is the previous plant image for comparison: " + previousImageUrl
        })
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 500
      })

      const analysis = response.choices[0]?.message?.content
      if (!analysis) {
        throw new Error('Failed to get analysis from OpenAI')
      }

      // Parse the analysis into structured data
      // This is a simple example - you might want to make this more robust
      const lines = analysis.split('\n')
      const checkupResult: CheckupResult = {
        stage: lines.find(l => l.includes('stage'))?.split(':')[1]?.trim() || 'Unknown',
        concerns: lines.filter(l => l.includes('concern') || l.includes('issue')).map(l => l.trim()),
        carePlan: lines.filter(l => l.includes('care') || l.includes('plan')).map(l => l.trim()),
        nextCheckupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        todoItems: lines.filter(l => l.includes('task') || l.includes('todo')).map(l => l.trim())
      }

      const checkup: PlantCheckup = {
        plantId,
        userId,
        date: new Date().toISOString(),
        imageUrl,
        checkupResult,
        completedTodos: [],
        ...(previousImageUrl && {
          growthAnalysis: {
            rate: lines.find(l => l.includes('rate'))?.split(':')[1]?.trim() || 'Unknown',
            changes: lines.filter(l => l.includes('change')).map(l => l.trim())
          }
        })
      }

      const result = await checkupsCollection.insertOne(checkup)

      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          message: 'Checkup created successfully',
          checkupId: result.insertedId,
          checkup
        })
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Invalid request' })
    }
  } catch (error) {
    console.error('Error handling plant checkup:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
} 