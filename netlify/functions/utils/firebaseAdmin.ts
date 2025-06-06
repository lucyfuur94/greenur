import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config(); // Ensure environment variables are loaded

if (!admin.apps.length) {
  try {
    let serviceAccountInput;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      // Environment variable is expected to be a JSON string
      serviceAccountInput = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      console.log('Firebase Admin: Loaded service account from FIREBASE_SERVICE_ACCOUNT_KEY env var');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Support for GOOGLE_APPLICATION_CREDENTIALS pointing to a file path (common in some environments)
      // Note: admin.credential.applicationDefault() handles this, but explicit loading can be clearer
      // For Netlify, FIREBASE_SERVICE_ACCOUNT_KEY as JSON string is preferred.
      // This branch is more for local dev or other environments if GOOGLE_APPLICATION_CREDENTIALS path is used.
      serviceAccountInput = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      console.log('Firebase Admin: Loaded service account from GOOGLE_APPLICATION_CREDENTIALS path');
    } else {
      // Fallback to requiring a local JSON file (ensure path is correct relative to built function)
      // For Netlify, functions are often bundled, so relative paths can be tricky.
      // It might be better to ensure FIREBASE_SERVICE_ACCOUNT_KEY is always set in Netlify.
      serviceAccountInput = require('./serviceAccountKey.json'); // Assumes serviceAccountKey.json is in the same dir (e.g. utils)
      console.log('Firebase Admin: Loaded service account from local ./serviceAccountKey.json (ensure it is bundled)');
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