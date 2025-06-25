// Edge Dispatcher Function
export default async (request, context) => {
  console.log(`EDGE DISPATCHER FUNCTION CALLED: ${Date.now()}: ${request.url}`);
  
  // Log environment variables for debugging
  console.log('Environment variables in edge-dispatcher:');
  if (typeof Deno !== 'undefined' && Deno.env) {
    console.log('Deno environment:');
    console.log('GEMINI_API_KEY:', Deno.env.get("GEMINI_API_KEY") ? 'Set' : 'Not set');
    console.log('VITE_GEMINI_API_KEY:', Deno.env.get("VITE_GEMINI_API_KEY") ? 'Set' : 'Not set');
  }
  
  if (context && context.env) {
    console.log('Context environment:');
    console.log('GEMINI_API_KEY:', context.env.GEMINI_API_KEY ? 'Set' : 'Not set');
    console.log('VITE_GEMINI_API_KEY:', context.env.VITE_GEMINI_API_KEY ? 'Set' : 'Not set');
  }
  
  if (typeof process !== 'undefined' && process.env) {
    console.log('Node environment:');
    console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'Set' : 'Not set');
    console.log('VITE_GEMINI_API_KEY:', process.env.VITE_GEMINI_API_KEY ? 'Set' : 'Not set');
  }
  
  // Handle OPTIONS request for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
  
  // Normalize the path by removing trailing slashes and index.htm
  const url = new URL(request.url);
  const path = url.pathname;
  const normalizedPath = path.replace(/\/+$/, '').replace(/\/index\.htm$/, '');
  
  console.log(`Original path: ${path}, Normalized path: ${normalizedPath}`);
  
  try {
    // Parse the request body
    const body = await request.json();
    
    // Extract the location and weather data if present
    const { messages, userProfile, pageContext, locationData, weatherData, modelId } = body;
    
    // Log the presence of location and weather data
    console.log('Request includes locationData:', !!locationData);
    console.log('Request includes weatherData:', !!weatherData);
    
    // Route based on the normalized path
    if (normalizedPath === '/botanist/chat') {
      // Route to the botanist-chat function
      const module = await import('./botanist-chat.js');
      return module.default(request, context);
    } 
    else if (normalizedPath === '/botanist/chat-generic') {
      // Route to the botanist-chat-generic-stream function
      console.log('Routing to botanist-chat-generic-stream with modelId:', modelId);
      console.log('Message format type:', modelId?.startsWith('gemini-') ? 'Gemini format' : 'OpenAI format');
      
      // Create a new request with the same body but add location and weather if available
      const requestBody = {
        messages,
        userProfile,
        pageContext,
        modelId
      };
      
      // Add location and weather data if available
      if (locationData) {
        requestBody.locationData = locationData;
      }
      
      if (weatherData) {
        requestBody.weatherData = weatherData;
      }
      
      // Create a new request with the updated body
      const newRequest = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: JSON.stringify(requestBody)
      });
      
      const module = await import('./botanist-chat-generic-stream.js');
      return module.default(newRequest, context);
    } 
    else if (normalizedPath === '/plant/details') {
      // Route to the plant-details-stream function (existing)
      const module = await import('./plant-details-stream.js');
      return module.default(request, context);
    }
    else {
      // Return a 404 for unknown routes
      return new Response(JSON.stringify({ 
        error: 'Not found', 
        path: path,
        normalizedPath: normalizedPath 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  } catch (error) {
    console.error('Error in edge-dispatcher:', error);
    return new Response(JSON.stringify({ 
      error: 'An error occurred while processing your request',
      details: error.message || 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}; 