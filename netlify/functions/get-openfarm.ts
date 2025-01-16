import { Handler } from '@netlify/functions'

const OPENFARM_API_ENDPOINT = 'https://openfarm.cc/api/v1/crops'

export const handler: Handler = async (event) => {
  const { q } = event.queryStringParameters || {}
  if (!q) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Query parameter is required' })
    }
  }

  try {
    const response = await fetch(
      `${OPENFARM_API_ENDPOINT}?filter=${encodeURIComponent(q)}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`OpenFarm API responded with ${response.status}`)
    }

    const data = await response.json()
    return {
      statusCode: 200,
      body: JSON.stringify(data)
    }
  } catch (error) {
    console.error('Error fetching OpenFarm data:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch plant care data' })
    }
  }
} 