// Central environment configuration
interface Env {
  // Firebase
  VITE_FIREBASE_API_KEY: string;
  VITE_FIREBASE_AUTH_DOMAIN: string;
  VITE_FIREBASE_PROJECT_ID: string;
  VITE_FIREBASE_STORAGE_BUCKET: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  VITE_FIREBASE_APP_ID: string;
  
  // Weather
  VITE_WEATHER_API_KEY: string;
  
  // OpenAI
  VITE_OPENAI_API_KEY: string;
  
  // Other services
  VITE_GOOGLE_TRANSLATE_KEY?: string;
}

export const env: Env = {
  VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY || '',
  VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID || '',
  VITE_WEATHER_API_KEY: import.meta.env.VITE_WEATHER_API_KEY || '',
  VITE_OPENAI_API_KEY: import.meta.env.VITE_OPENAI_API_KEY || '',
  VITE_GOOGLE_TRANSLATE_KEY: import.meta.env.VITE_GOOGLE_TRANSLATE_KEY || '',
};

// Validate required keys
const requiredKeys: (keyof Env)[] = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_WEATHER_API_KEY',
  'VITE_OPENAI_API_KEY',
];

requiredKeys.forEach(key => {
  if (!env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}); 