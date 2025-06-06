import { UserPreferences } from '../types';
import { auth } from '../firebase';  // Import Firebase auth

// Base URL for API requests
const API_BASE_URL = '/.netlify/functions';
const IS_DEV = import.meta.env.DEV;

/**
 * Fetches user preferences from MongoDB via serverless function
 * @param userId The user's Firebase auth ID
 * @returns User preferences object
 */
export async function fetchUserPreferences(userId: string): Promise<UserPreferences | null> {
  if (!userId) {
    console.error('fetchUserPreferences called with empty userId');
    return null;
  }

  console.log(`Fetching preferences for user: ${userId}`);
  
  try {
    // Get the current user's ID token for authentication
    const authToken = await getIdToken();
    console.log('Auth token obtained:', !!authToken);
    
    const url = `${API_BASE_URL}/update-user-preferences?userId=${userId}`;
    console.log('Fetching preferences from URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : ''
      }
    });

    console.log('Preferences fetch response status:', response.status);

    if (!response.ok) {
      // Log the error but don't throw - we'll try the fallback
      console.warn(`Failed to fetch user preferences: ${response.status}`);
      throw new Error('API request failed');
    }

    const data = await response.json();
    console.log('Preferences data received:', JSON.stringify({
      completedOnboarding: data.preferences?.completedOnboarding,
      skippedOnboarding: data.preferences?.skippedOnboarding,
    }));
    
    return adaptPreferences(data.preferences);
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    // In development, fall back to localStorage
    if (IS_DEV) {
      const storedPrefs = localStorage.getItem(`user_prefs_${userId}`);
      if (storedPrefs) {
        console.log('Using localStorage fallback for preferences');
        return JSON.parse(storedPrefs);
      }
    }
    return null;
  }
}

// Helper function to get ID token from Firebase auth
async function getIdToken(): Promise<string | null> {
  try {
    // Get the current user from imported auth
    const currentUser = auth.currentUser;
    if (!currentUser) return null;
    
    // Get the current user's ID token
    const token = await currentUser.getIdToken(true);
    return token;
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
}

/**
 * Updates user preferences in MongoDB via serverless function
 * @param userId The user's Firebase auth ID
 * @param preferences User preferences object to update
 * @returns Updated user preferences
 */
export async function updateUserPreferences(
  userId: string,
  preferences: Partial<UserPreferences>
): Promise<UserPreferences | null> {
  try {
    const formattedPreferences = formatPreferencesForAPI(preferences);
    
    // Try to use the Netlify function
    try {
      const response = await fetch(`${API_BASE_URL}/update-user-preferences?userId=${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formattedPreferences)
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();
      const updatedPreferences = adaptPreferences(data.preferences);
      
      // Store in localStorage as a backup in development
      if (IS_DEV) {
        localStorage.setItem(`user_prefs_${userId}`, JSON.stringify(updatedPreferences));
      }
      
      return updatedPreferences;
    } catch (apiError) {
      console.error('API error:', apiError);
      
      // In development, fallback to using localStorage
      if (IS_DEV) {
        console.warn('Development fallback: Using localStorage for user preferences');
        // Get current preferences from localStorage
        const storedPrefsStr = localStorage.getItem(`user_prefs_${userId}`);
        const storedPrefs = storedPrefsStr ? JSON.parse(storedPrefsStr) : defaultPreferences();
        
        // Merge with new preferences
        const updatedPrefs = {
          ...storedPrefs,
          ...preferences
        };
        
        // Save back to localStorage
        localStorage.setItem(`user_prefs_${userId}`, JSON.stringify(updatedPrefs));
        return updatedPrefs;
      }
      
      // In production, re-throw the error
      throw apiError;
    }
  } catch (error) {
    console.error('Error updating user preferences:', error);
    throw error;
  }
}

/**
 * Default preferences when nothing is found
 */
function defaultPreferences(): UserPreferences {
  return {
    name: '',
    experience: 'beginner',
    gardenType: 'indoor',
    growingSpaces: [],
    interests: [],
    checkupFrequency: '2',
    checkupDays: [],
    completedOnboarding: false,
    onboardingStep: 1,
    onboardingProgress: 20,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Adapts MongoDB user preferences to our app's UserPreferences type
 */
function adaptPreferences(dbPreferences: any): UserPreferences {
  if (!dbPreferences) {
    return defaultPreferences();
  }

  return {
    name: dbPreferences.name || '',
    experience: dbPreferences.experience || 'beginner',
    gardenType: dbPreferences.gardenType || 'indoor',
    growingSpaces: dbPreferences.growingSpaces || [],
    interests: dbPreferences.interests || [],
    checkupFrequency: dbPreferences.checkupFrequency?.toString() || '2',
    checkupDays: dbPreferences.preferredCheckupDays?.map((day: string) => 
      day.charAt(0).toUpperCase() + day.slice(1, 3)
    ) || [],
    firstPlant: dbPreferences.firstPlant || undefined,
    completedOnboarding: dbPreferences.completedOnboarding || false,
    skippedOnboarding: dbPreferences.skippedOnboarding || false,
    onboardingProgress: dbPreferences.onboardingProgress || 0,
    onboardingStep: dbPreferences.onboardingStep || 1,
    lastUpdated: dbPreferences.lastUpdated || new Date().toISOString()
  };
}

/**
 * Formats app's UserPreferences type for MongoDB API
 */
function formatPreferencesForAPI(preferences: Partial<UserPreferences>): any {
  const apiPreferences: any = { ...preferences };
  
  // Convert checkupFrequency from string to number if present
  if (apiPreferences.checkupFrequency) {
    apiPreferences.checkupFrequency = parseInt(apiPreferences.checkupFrequency, 10);
  }
  
  // Convert checkupDays to preferredCheckupDays format if present
  if (apiPreferences.checkupDays) {
    apiPreferences.preferredCheckupDays = apiPreferences.checkupDays.map((day: string) => 
      day.toLowerCase() === 'sat' ? 'saturday' : 
      day.toLowerCase() === 'sun' ? 'sunday' :
      day.toLowerCase()
    );
    delete apiPreferences.checkupDays;
  }
  
  return apiPreferences;
} 