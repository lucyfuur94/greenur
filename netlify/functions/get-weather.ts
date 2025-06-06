import { Handler } from '@netlify/functions'
import { getAuth } from 'firebase-admin/auth'

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY

export const handler: Handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    // Verify Firebase Auth token
    const authHeader = event.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return { statusCode: 401, body: 'Unauthorized' }
    }

    const token = authHeader.split('Bearer ')[1]
    try {
      await getAuth().verifyIdToken(token)
    } catch (error) {
      return { statusCode: 401, body: 'Invalid token' }
    }

    // Get coordinates from query params
    const { lat, lon } = event.queryStringParameters || {}
    if (!lat || !lon) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Latitude and longitude are required' })
      }
    }

    // Call OpenWeatherMap API
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_API_KEY}`
    )

    if (!response.ok) {
      throw new Error('Failed to fetch weather data')
    }

    const data = await response.json()

    return {
      statusCode: 200,
      body: JSON.stringify({
        temp: data.main.temp,
        humidity: data.main.humidity,
        description: data.weather[0].description
      })
    }
  } catch (error) {
    console.error('Error fetching weather:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch weather data' })
    }
  }
} 