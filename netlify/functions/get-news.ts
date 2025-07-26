import { Handler } from '@netlify/functions'

const NEWSAPI_KEY = process.env.VITE_NEWSAPI_KEY
const NEWSAPI_ENDPOINT = 'https://newsapi.org/v2/everything'

export const handler: Handler = async (event) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    }
  }

  if (!NEWSAPI_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'NewsAPI key not configured' })
    }
  }

  const { query, limit = '10' } = event.queryStringParameters || {}
  if (!query) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Query parameter is required' })
    }
  }

  try {
    // Build the API URL with parameters according to NewsAPI documentation
    const searchParams = new URLSearchParams({
      q: query, // Search keywords/phrase
      language: 'en', // Language (English)
      pageSize: limit, // Number of results to return per page
      sortBy: 'publishedAt', // Sort by published date (newest first)
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // From last 30 days
    })

    const response = await fetch(`${NEWSAPI_ENDPOINT}?${searchParams}`, {
      headers: {
        'X-API-Key': NEWSAPI_KEY,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`NewsAPI responded with ${response.status}: ${errorData.message || 'Unknown error'}`)
    }

    const data = await response.json()
    
    // Check if the response indicates success
    if (data.status !== 'ok') {
      throw new Error(`NewsAPI error: ${data.message || 'Unknown error'}`)
    }
    
    // Transform the data to match our expected format
    const articles = data.articles || []
    
    const transformedData = {
      success: true,
      articles: articles.map((article: any) => ({
        id: article.url ? btoa(article.url).slice(0, 16) : Math.random().toString(36),
        title: article.title,
        excerpt: article.description || article.content?.substring(0, 200) + '...' || 'No description available',
        image: article.urlToImage,
        publishedAt: article.publishedAt,
        url: article.url,
        source: article.source?.name || 'Unknown'
      })),
      total: data.totalResults || articles.length
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(transformedData)
    }
  } catch (error) {
    console.error('Error fetching news from NewsAPI:', error)
    
    // Return fallback data in case of API errors
    const fallbackData = {
      success: true,
      articles: [
        {
          id: 'fallback-1',
          title: `Latest ${query} updates`,
          excerpt: 'Stay updated with the latest news and trends.',
          image: null,
          publishedAt: new Date().toISOString(),
          url: '#',
          source: 'Fallback'
        },
        {
          id: 'fallback-2',
          title: `${query} industry insights`,
          excerpt: 'Comprehensive coverage of industry developments.',
          image: null,
          publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          url: '#',
          source: 'Fallback'
        }
      ],
      total: 2
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(fallbackData)
    }
  }
} 