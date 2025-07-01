import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config(); // Ensure environment variables are loaded

if (!admin.apps.length) {
  try {
    let serviceAccountInput: any;
    
    // Try to load from environment variable first
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        serviceAccountInput = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        console.log('Firebase Admin: Loaded service account from FIREBASE_SERVICE_ACCOUNT_JSON env var');
      } catch (error) {
        console.error('Firebase Admin: Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', error);
      }
    }
    
    // If no environment variable, try loading from local file
    if (!serviceAccountInput) {
      try {
        serviceAccountInput = require('./serviceAccountKey.json');
        console.log('Firebase Admin: Loaded service account from local file');
      } catch (fileError) {
        console.error('Firebase Admin: Error loading local service account:', fileError);
        throw new Error('Firebase service account not configured');
      }
    }
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountInput)
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('CRITICAL: Error initializing Firebase Admin SDK:', error);
    // Depending on the application, you might want to throw this error 
    // to prevent functions from running without proper admin setup.
  }
} else {
  console.log('Firebase Admin SDK already initialized.');
}

/**
 * Verifies a Firebase ID token from an Authorization header.
 * @param authHeader The Authorization header string (e.g., "Bearer <token>").
 * @returns The UID of the authenticated user, or null if verification fails.
 */
export async function verifyAuthToken(authHeader: string | undefined): Promise<string | null> {
  if (!admin.apps.length) {
    console.error('Firebase Admin SDK not initialized. Cannot verify auth token.');
    return null; // Or throw an error
  }
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('No valid auth header found for token verification.');
    return null;
  }
  
  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return null;
  }
}

// Export the initialized admin instance if needed elsewhere, though typically not directly.
export { admin }; 