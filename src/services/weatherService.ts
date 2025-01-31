import { WEATHER_API_KEY } from '../config/weatherConfig';

// Add logging to check API key
console.log('[WeatherService] API Key status:', WEATHER_API_KEY ? 'Present' : 'Missing');

export interface WeatherData {
  location: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
  };
  current: {
    temp_c: number;
    condition: {
      text: string;
      icon: string;
    };
    humidity: number;
    wind_kph: number;
  };
  forecast: {
    forecastday: Array<{
      date: string;
      day: {
        maxtemp_c: number;
        mintemp_c: number;
        condition: {
          text: string;
          icon: string;
        };
      };
    }>;
  };
}

const handleWeatherResponse = async (response: Response) => {
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Invalid or missing API key. Please check your weather API configuration.');
    }
    const errorText = await response.text();
    throw new Error(`Weather API error: ${response.status} - ${errorText}`);
  }
  return await response.json();
};

export const getWeatherData = async (lat: number, lon: number): Promise<WeatherData> => {
  // Use Netlify's environment variable format
  const apiKey = import.meta.env.VITE_WEATHER_API_KEY || process.env.VITE_WEATHER_API_KEY;
  
  if (!apiKey) {
    throw new Error('[WeatherService] API key not configured. Check Netlify environment variables');
  }

  const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lat},${lon}`;
  try {
    console.log('[WeatherService] Making API call for coordinates:', { lat, lon });
    const response = await fetch(
      url,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
      }
    );

    return await handleWeatherResponse(response);
  } catch (error) {
    console.error('[WeatherService] Error fetching weather data:', error);
    throw error;
  }
};

export const getWeatherByCity = async (city: string): Promise<WeatherData> => {
  try {
    if (!WEATHER_API_KEY) {
      console.error('[WeatherService] Weather API key is not configured. Check your .env.local file.');
      throw new Error('Weather API key is not configured');
    }

    console.log('[WeatherService] Making API call for city:', city);
    const response = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${encodeURIComponent(city)}&days=7&aqi=no`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        mode: 'cors',
      }
    );

    return await handleWeatherResponse(response);
  } catch (error) {
    console.error('[WeatherService] Error fetching weather data:', error);
    throw error;
  }
}; 