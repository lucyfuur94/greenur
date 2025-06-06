import { Handler } from '@netlify/functions'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import * as admin from 'firebase-admin'
import path from 'path'
import fs from 'fs'

dotenv.config()

const MONGO_URI = process.env.MONGO_URI
const DB_NAME = process.env.MONGODB_DB || 'master'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Content-Length, X-Requested-With',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

// Initialize Firebase Admin safely
let firebaseInitialized = false
try {
  if (!admin.apps.length) {
    // Try to load service account from environment variable
    let serviceAccount
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
    } else {
      // Try to load from file as fallback
      try {
        const serviceAccountPath = path.join(__dirname, 'utils', 'serviceAccountKey.json')
        if (fs.existsSync(serviceAccountPath)) {
          serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
        }
      } catch (fileError) {
        console.error('Error loading service account from file:', fileError)
      }
    }
    
    if (!serviceAccount) {
      console.error('Firebase service account not found')
    } else {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET
      })
      firebaseInitialized = true
      console.log('Firebase Admin initialized successfully')
    }
  } else {
    firebaseInitialized = true
    console.log('Firebase Admin already initialized')
  }
} catch (error) {
  console.error('Firebase admin initialization error:', error)
}

export const handler: Handler = async (event, context) => {
  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  // Check if Firebase is initialized
  if (!firebaseInitialized) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Firebase not initialized',
        details: 'Firebase Admin SDK could not be initialized. Check server logs for details.'
      })
    }
  }

  const userId = event.queryStringParameters?.userId
  if (!userId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'User ID is required' })
    }
  }

  try {
    // Parse the request body to get the current photoURL (optional)
    let photoURL: string | null = null
    if (event.body) {
      const parsedBody = JSON.parse(
        event.isBase64Encoded 
          ? Buffer.from(event.body, 'base64').toString() 
          : event.body
      )
      photoURL = parsedBody.photoURL
    }

    // If photoURL is provided, try to delete the file from Firebase Storage
    if (photoURL && typeof photoURL === 'string') {
      try {
        // Extract the file path from the URL
        // Format: https://storage.googleapis.com/BUCKET_NAME/FILE_PATH
        const bucket = admin.storage().bucket()
        const urlParts = photoURL.split(`https://storage.googleapis.com/${bucket.name}/`)
        
        if (urlParts.length > 1) {
          const filePath = urlParts[1]
          const file = bucket.file(filePath)
          
          // Check if file exists before deleting
          const [exists] = await file.exists()
          if (exists) {
            await file.delete()
            console.log(`Deleted file: ${filePath}`)
          }
        }
      } catch (storageError) {
        console.error('Error deleting file from storage:', storageError)
        // Continue with profile update even if storage deletion fails
      }
    }
    
    // Update user in MongoDB to remove photoURL
    let client: MongoClient | null = null
    try {
      if (!MONGO_URI) {
        throw new Error('MongoDB URI is not defined')
      }
      
      client = await MongoClient.connect(MONGO_URI)
      const db = client.db(DB_NAME)
      const usersCollection = db.collection('users')
      
      await usersCollection.updateOne(
        { uid: userId },
        { $unset: { photoURL: "" } }
      )
    } catch (dbError) {
      console.error('Error updating user in database:', dbError)
      throw dbError
    } finally {
      if (client) await client.close()
    }
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: true,
        message: 'Profile photo removed successfully'
      })
    }
  } catch (error) {
    console.error('Error removing profile photo:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Failed to remove profile photo',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
} 