export const WEATHER_API_KEY = import.meta.env.VITE_WEATHER_API_KEY || '';
export const DEFAULT_LOCATION = {
  name: 'New Delhi',
  country: 'India',
  lat: 28.6139,
  lon: 77.2090
};

// Validation check
if (!WEATHER_API_KEY) {
  console.error('[WeatherConfig] Weather API key is missing!');
  if (import.meta.env.PROD) {
    throw new Error('Weather API configuration error');
  }
} else {
  console.log('[WeatherConfig] Weather API key loaded successfully');
} 