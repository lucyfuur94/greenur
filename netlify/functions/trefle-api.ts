import { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';

const TREFLE_API_URL = 'https://trefle.io/api/v1';
const TREFLE_API_TOKEN = process.env.TREFLE_API_TOKEN;

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
      headers: {
        'Content-Type': 'application/json'
      }
    };
  }

  try {
    if (!TREFLE_API_TOKEN) {
      throw new Error('TREFLE_API_TOKEN is not configured');
    }

    // Get the path and query parameters from the request
    const path = event.path.replace('/.netlify/functions/trefle-api', '');
    
    // Convert query parameters to URLSearchParams
    const params = new URLSearchParams();
    if (event.queryStringParameters) {
      Object.entries(event.queryStringParameters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }

    // Build the Trefle API URL
    const url = `${TREFLE_API_URL}${path}${params.toString() ? '?' + params.toString() : ''}`;
    console.log('[Trefle API] Requesting:', url);

    // Make the request to Trefle API
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TREFLE_API_TOKEN}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[Trefle API] Non-JSON response:', text);
      throw new Error('Invalid response from Trefle API');
    }

    const data = await response.json();
    console.log('[Trefle API] Response status:', response.status);

    if (!response.ok) {
      console.error('[Trefle API] Error response:', data);
      throw new Error(data.message || 'Failed to fetch data from Trefle API');
    }

    // Return the response
    return {
      statusCode: 200,
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    } as HandlerResponse;

  } catch (error) {
    console.error('[Trefle API] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to fetch data from Trefle API'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    } as HandlerResponse;
  }
}; 