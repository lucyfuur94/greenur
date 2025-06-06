import { Handler } from '@netlify/functions'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const YOUTUBE_API_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search'

export const handler: Handler = async (event) => {
  if (!YOUTUBE_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key not configured' })
    }
  }

  const { q } = event.queryStringParameters || {}
  if (!q) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Query parameter is required' })
    }
  }

  try {
    const response = await fetch(
      `${YOUTUBE_API_ENDPOINT}?part=snippet&q=${encodeURIComponent(q)}&maxResults=15&type=video&key=${YOUTUBE_API_KEY}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`YouTube API responded with ${response.status}`)
    }

    const data = await response.json()
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    }
  } catch (error) {
    console.error('Error fetching videos:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch videos' })
    }
  }
} 