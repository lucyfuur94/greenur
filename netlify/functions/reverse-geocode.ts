import { Handler } from '@netlify/functions';

const reverseGeocodeHandler: Handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Get API key from environment variables
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  
  if (!GOOGLE_API_KEY) {
    console.error('GOOGLE_API_KEY environment variable is not set');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API configuration error' })
    };
  }

  try {
    const { lat, lng } = event.queryStringParameters || {};
    
    if (!lat || !lng) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Latitude and longitude are required' })
      };
    }

    // Use Google Geocoding API for reverse geocoding
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}&result_type=locality|administrative_area_level_1`,
      {
        method: 'GET',
      }
    );
    
    const data = await response.json();
    
    // Extract the most relevant location name
    let locationName = 'Current Location';
    if (data.status === 'OK' && data.results.length > 0) {
      // Prefer locality (city) first, then administrative area (state/region)
      const localityResult = data.results.find((result: any) => 
        result.types.includes('locality')
      );

      const adminResult = data.results.find((result: any) => 
        result.types.includes('administrative_area_level_1')
      );

      locationName = localityResult 
        ? localityResult.formatted_address.split(',')[0]
        : (adminResult 
          ? adminResult.formatted_address.split(',')[0]
          : 'Current Location');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET'
      },
      body: JSON.stringify({
        locationName,
        fullAddress: data.results[0]?.formatted_address || 'Unknown Location',
        status: data.status
      })
    };
  } catch (error) {
    console.error('Error reverse geocoding:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};

export const handler = reverseGeocodeHandler; 