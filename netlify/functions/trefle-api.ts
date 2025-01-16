import { Handler } from '@netlify/functions';

const TREFLE_API_URL = 'https://trefle.io/api/v1';
const TREFLE_API_TOKEN = process.env.TREFLE_API_TOKEN;

export const handler: Handler = async (event) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
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

    // Make the request to Trefle API
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TREFLE_API_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    // Return the response
    return {
      statusCode: response.status,
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json'
      }
    };

  } catch (error) {
    console.error('Error proxying request to Trefle API:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch data from Trefle API' })
    };
  }
}; 