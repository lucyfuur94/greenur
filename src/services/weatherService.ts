import { env } from '../config/env';

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
  // Use env.VITE_WEATHER_API_KEY
  const apiKey = env.VITE_WEATHER_API_KEY;
  
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
  const apiKey = env.VITE_WEATHER_API_KEY;
  
  if (!apiKey) {
    throw new Error('[WeatherService] API key not configured. Check Netlify environment variables');
  }

  try {
    console.log('[WeatherService] Making API call for city:', city);
    const response = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(city)}&days=7&aqi=no`,
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

if (!env.VITE_WEATHER_API_KEY) {
  throw new Error('Weather API key missing in environment variables');
} 