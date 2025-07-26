import { Handler } from '@netlify/functions'
import * as admin from 'firebase-admin'
import { getStorage } from 'firebase-admin/storage'
import * as path from 'path'
import * as fs from 'fs'

// Initialize Firebase Admin with service account
if (!admin.apps.length) {
  try {
    let serviceAccount;
    
    // Try to load from environment variable first
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        console.log('[delete-file] Loaded service account from environment variable');
      } catch (parseError) {
        console.error('[delete-file] Error parsing FIREBASE_SERVICE_ACCOUNT_JSON:', parseError);
      }
    }
    
    // If no environment variable, try loading from local file
    if (!serviceAccount) {
      try {
        serviceAccount = require('./utils/serviceAccountKey.json');
        console.log('[delete-file] Loaded service account from local file');
      } catch (fileError) {
        console.error('[delete-file] Error loading local service account:', fileError);
        throw fileError;
      }
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET
    });
    console.log('[delete-file] Firebase Admin initialized successfully');
  } catch (error) {
    console.error('[delete-file] Error initializing Firebase Admin:', error);
    throw error;
  }
}

const bucket = getStorage().bucket()

const handler: Handler = async (event) => {
  console.log('[delete-file] Starting function with event:', {
    httpMethod: event.httpMethod,
    headers: event.headers,
    isBase64Encoded: event.isBase64Encoded,
    bodyLength: event.body?.length
  })

  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    }
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    }
  }

  try {
    // Parse the request body
    const body = JSON.parse(event.body || '{}')
    const { filePath, userId } = body

    if (!filePath) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'File path is required' })
      }
    }

    // Verify user has permission to delete this file
    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'User ID is required' })
      }
    }

    // Ensure the file belongs to the user
    if (!filePath.includes(userId)) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'You do not have permission to delete this file' })
      }
    }

    console.log('[delete-file] Deleting file:', filePath)

    // Delete the file from Firebase Storage
    const file = bucket.file(filePath)
    const [exists] = await file.exists()

    if (!exists) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'File not found' })
      }
    }

    await file.delete()
    console.log('[delete-file] File deleted successfully')

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'File deleted successfully'
      })
    }
  } catch (error) {
    console.error('[delete-file] Error deleting file:', error)
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to delete file',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
    }
  }
}

export { handler } 