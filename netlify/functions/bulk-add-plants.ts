import { Handler } from '@netlify/functions'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import { extract_plant_info } from './utils/plant/plantUtils'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

const handler: Handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  let client: MongoClient | null = null

  try {
    const { plantNames } = JSON.parse(event.body || '{}')
    
    if (!Array.isArray(plantNames) || plantNames.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Plant names array is required' }),
      }
    }

    // Connect to MongoDB
    client = new MongoClient(MONGO_URI!)
    await client.connect()

    const db = client.db(DB_NAME)
    const collection = db.collection('plant_basics')

    // Get next available ID by counting documents
    const totalDocs = await collection.countDocuments()
    let nextId = totalDocs + 1

    const results = {
      success: [] as any[],
      failed: [] as any[],
      duplicates: [] as string[]
    }

    // Process each plant name
    for (const plantName of plantNames) {
      try {
        // Skip empty names
        if (!plantName.trim()) continue

        // Check for duplicate
        const existingPlant = await collection.findOne({
          common_name: { $regex: new RegExp(`^${plantName}$`, 'i') }
        })

        if (existingPlant) {
          results.duplicates.push(plantName)
          continue
        }

        // Extract plant information
        const plantInfo = await extract_plant_info(nextId, plantName)
        
        // Remove the _id field and let MongoDB generate it
        const { _id, ...documentToInsert } = plantInfo
        
        // Insert new plant
        await collection.insertOne(documentToInsert)
        results.success.push(documentToInsert)
        nextId++

      } catch (error) {
        console.error(`Error processing plant ${plantName}:`, error)
        results.failed.push({
          name: plantName,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST',
      },
      body: JSON.stringify({
        message: 'Bulk plant addition completed',
        results: {
          totalProcessed: plantNames.length,
          successCount: results.success.length,
          failedCount: results.failed.length,
          duplicateCount: results.duplicates.length,
          ...results
        }
      }),
    }
  } catch (error) {
    console.error('Error in bulk add plants:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process plants' }),
    }
  } finally {
    if (client) {
      await client.close()
    }
  }
}

export { handler } 