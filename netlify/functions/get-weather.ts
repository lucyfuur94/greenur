import { Handler } from '@netlify/functions'
import { verifyAuthToken } from './utils/firebaseAdmin'

const OPENWEATHER_API_KEY = process.env.VITE_WEATHER_API_KEY

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export const handler: Handler = async (event, context) => {
  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: '',
    }
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return { 
      statusCode: 405, 
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    }
  }

  try {
    // Verify Firebase Auth token
    const authHeader = event.headers.authorization
    const authorizedUserId = await verifyAuthToken(authHeader)
    
    if (!authorizedUserId) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Unauthorized: Invalid or missing authentication token' })
      }
    }

    // Get coordinates from query params
    const { lat, lon } = event.queryStringParameters || {}
    if (!lat || !lon) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Latitude and longitude are required' })
      }
    }

    if (!OPENWEATHER_API_KEY) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Weather API key not configured' })
      }
    }

    // Fetch current weather and hourly forecast in parallel
    const [currentResponse, forecastResponse] = await Promise.all([
      fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`
      ),
      fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`
      )
    ])

    if (!currentResponse.ok) {
      throw new Error('Failed to fetch current weather data')
    }

    if (!forecastResponse.ok) {
      throw new Error('Failed to fetch forecast data')
    }

    const currentData = await currentResponse.json()
    const forecastData = await forecastResponse.json()

    // Process hourly forecast for next 12 hours
    const now = new Date()
    const hourlyForecast: Array<{
      time: string;
      datetime: string;
      temp: number;
      humidity: number;
      condition: string;
      description: string;
      windSpeed: number;
      precipitation: number;
    }> = []
    
    // Generate 12 hourly data points by interpolating from 3-hour forecast data
    for (let i = 0; i < 12; i++) {
      const targetTime = new Date(now.getTime() + i * 60 * 60 * 1000) // Each hour
      
      // Find the closest forecast data points for interpolation
      const forecastIndex = Math.floor(i / 3)
      const item = forecastData.list[Math.min(forecastIndex, forecastData.list.length - 1)]
      const nextItem = forecastData.list[Math.min(forecastIndex + 1, forecastData.list.length - 1)]
      
      if (item) {
        // Simple interpolation for temperature within 3-hour intervals
        let temp = item.main.temp
        if (nextItem && forecastIndex < forecastData.list.length - 1) {
          const progress = (i % 3) / 3 // Progress within the 3-hour interval
          temp = item.main.temp + (nextItem.main.temp - item.main.temp) * progress
        }
        
        hourlyForecast.push({
          time: targetTime.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            hour12: true 
          }),
          datetime: targetTime.toISOString(),
          temp: Math.round(temp),
          humidity: item.main.humidity,
          condition: item.weather[0].main.toLowerCase(),
          description: item.weather[0].description,
          windSpeed: item.wind?.speed || 0,
          precipitation: item.rain?.['3h'] || item.snow?.['3h'] || 0
        })
      }
    }

    // Process 5-day forecast
    const dailyForecast: Array<{
      date: string;
      min: number;
      max: number;
      condition: string;
      description: string;
      humidity: number;
    }> = []
    const processedDates = new Set()
    
    for (const item of forecastData.list) {
      const date = new Date(item.dt * 1000)
      const dateStr = date.toDateString()
      
      if (!processedDates.has(dateStr) && date.getDate() !== now.getDate()) {
        processedDates.add(dateStr)
        dailyForecast.push({
          date: date.toISOString().split('T')[0],
          min: Math.round(item.main.temp_min),
          max: Math.round(item.main.temp_max),
          condition: item.weather[0].main.toLowerCase(),
          description: item.weather[0].description,
          humidity: item.main.humidity
        })
        
        if (dailyForecast.length >= 5) break
      }
    }

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        current: {
          temp: Math.round(currentData.main.temp),
          humidity: currentData.main.humidity,
          condition: currentData.weather[0].main.toLowerCase(),
          description: currentData.weather[0].description,
          windSpeed: currentData.wind?.speed || 0,
          windDeg: currentData.wind?.deg,
          pressure: currentData.main.pressure,
          location: currentData.name
        },
        hourlyForecast,
        dailyForecast
      })
    }
  } catch (error) {
    console.error('Error fetching weather:', error)
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to fetch weather data' })
    }
  }
} 