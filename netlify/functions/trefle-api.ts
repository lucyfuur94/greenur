import { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import dotenv from 'dotenv';

// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

const TREFLE_API_URL = 'https://trefle.io/api/v1';
const TREFLE_API_TOKEN = process.env.TREFLE_API_TOKEN;

export const handler: Handler = async (event: HandlerEvent): Promise<HandlerResponse> => {
  // Log every request at the start
  console.log('🌿 [Trefle API] Request received:', {
    path: event.path,
    method: event.httpMethod,
    queryParams: event.queryStringParameters,
    headers: event.headers,
    hasToken: Boolean(TREFLE_API_TOKEN)
  });

  try {
    // Check for API token
    if (!TREFLE_API_TOKEN) {
      console.error('❌ [Trefle API] Error: TREFLE_API_TOKEN is not configured');
      throw new Error('TREFLE_API_TOKEN is not configured. Please set it in your environment variables.');
    }

    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
      console.warn('⚠️ [Trefle API] Warning: Method not allowed:', event.httpMethod);
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method Not Allowed' }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    // Get the path and query parameters
    const path = event.path.split('/trefle-api')[1] || '';
    console.log('🔍 [Trefle API] Processing path:', path);

    // Map endpoints
    let trefleEndpoint = '';
    if (path === '/search') {
      trefleEndpoint = '/api/v1/plants/search';
    } else if (path.startsWith('/plant/')) {
      trefleEndpoint = '/api/v1/plants/' + path.split('/plant/')[1];
    } else {
      console.error('❌ [Trefle API] Error: Invalid endpoint:', path);
      throw new Error(`Invalid endpoint: ${path}`);
    }

    // Build query parameters
    const params = new URLSearchParams();
    if (event.queryStringParameters) {
      Object.entries(event.queryStringParameters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }

    // Build URL with token
    const url = `https://trefle.io${trefleEndpoint}?token=${TREFLE_API_TOKEN}${params.toString() ? '&' + params.toString() : ''}`;
    console.log('🌐 [Trefle API] Making request to:', url.replace(TREFLE_API_TOKEN, '[REDACTED]'));

    // Make request
    console.time('🕒 [Trefle API] Request duration');
    const response = await fetch(url);
    console.timeEnd('🕒 [Trefle API] Request duration');
    
    // Log response details
    console.log('📥 [Trefle API] Response received:', {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    // Handle error responses
    if (!response.ok) {
      const text = await response.text();
      console.error('❌ [Trefle API] Error response:', {
        status: response.status,
        statusText: response.statusText,
        body: text
      });
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: text }),
        headers: { 'Content-Type': 'application/json' }
      };
    }

    const data = await response.json();
    console.log('✅ [Trefle API] Success response:', {
      dataType: typeof data,
      hasData: Boolean(data),
      meta: data.meta
    });

    return {
      statusCode: 200,
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    };

  } catch (error) {
    console.error('💥 [Trefle API] Fatal error:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error'
      }),
      headers: { 'Content-Type': 'application/json' }
    };
  }
}; 