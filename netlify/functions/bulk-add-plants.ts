import { Handler } from '@netlify/functions'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

interface PlantData {
  common_name: string
  scientific_name: string
  plant_type: string
  names_in_languages: { [key: string]: string }
}

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
    const { plants } = JSON.parse(event.body || '{}')
    
    if (!Array.isArray(plants) || plants.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Plants array is required' }),
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

    // Process each plant
    for (const plant of plants) {
      try {
        // Validate required fields
        if (!plant.common_name || !plant.scientific_name || !plant.plant_type) {
          results.failed.push({
            plant: plant.common_name || 'Unknown',
            error: 'Missing required fields: common_name, scientific_name, or plant_type'
          })
          continue
        }

        // Check for duplicate
        const existingPlant = await collection.findOne({
          $or: [
            { common_name: { $regex: new RegExp(`^${plant.common_name}$`, 'i') } },
            { scientific_name: { $regex: new RegExp(`^${plant.scientific_name}$`, 'i') } }
          ]
        })

        if (existingPlant) {
          results.duplicates.push(plant.common_name)
          continue
        }

        // Create plant document
        const documentToInsert = {
          id: nextId,
          common_name: plant.common_name,
          scientific_name: plant.scientific_name,
          plant_type: plant.plant_type,
          names_in_languages: plant.names_in_languages || {},
          default_image_url: '',
          last_updated: new Date().toISOString()
        }
        
        // Insert new plant
        await collection.insertOne(documentToInsert)
        results.success.push(documentToInsert)
        nextId++

      } catch (error) {
        console.error(`Error processing plant ${plant.common_name}:`, error)
        results.failed.push({
          plant: plant.common_name || 'Unknown',
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
          totalProcessed: plants.length,
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