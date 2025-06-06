// Plant Details Stream Edge Function
export default async (request, context) => {
  // Add detailed logging for debugging
  console.log(`PLANT-DETAILS-STREAM FUNCTION CALLED: ${Date.now()}: ${request.url}`);
  console.log(`Request method: ${request.method}`);
  console.log(`Request headers: ${JSON.stringify([...request.headers])}`);

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

  try {
    // Get API key from environment variables
    let apiKey;
    
    // For Netlify Edge Functions in production
    if (typeof Deno !== 'undefined' && Deno.env) {
      apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("VITE_OPENAI_API_KEY");
    }
    
    // For local development with Netlify CLI
    if (!apiKey && context && context.env) {
      apiKey = context.env.OPENAI_API_KEY || context.env.VITE_OPENAI_API_KEY;
    }
    
    // For Node.js environments
    if (!apiKey && typeof process !== 'undefined' && process.env) {
      apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    }
    
    if (!apiKey) {
      console.error('OpenAI API key is not configured in environment variables');
      return new Response(JSON.stringify({ 
        error: 'OpenAI API key is not configured',
        env: typeof Deno !== 'undefined' ? 'Deno' : (typeof process !== 'undefined' ? 'Node' : 'Unknown'),
        hasContext: !!context,
        hasContextEnv: !!(context && context.env)
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Parse the request body
    const body = await request.json();
    const { plantName, scientificName } = body;

    if (!plantName) {
      return new Response(JSON.stringify({ error: 'Invalid request: plantName is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Create the system prompt for plant details
    const PLANT_DETAILS_SYSTEM_PROMPT = `
      You are Greenur's plant expert botanist assistant. Your task is to provide detailed information about the plant: ${plantName} (Scientific name: ${scientificName || 'Unknown'}).
      
      Please provide a comprehensive guide that includes:
      
      1. Basic information about the plant
      2. Care instructions (water, light, soil, temperature, humidity)
      3. Common issues and troubleshooting
      4. Interesting facts about the plant
      5. Propagation methods
      
      Format your response using markdown for better readability:
      - Use # for the main title (plant name)
      - Use ## for section headings
      - Use **bold** for emphasis
      - Use *italics* for scientific names
      - Use proper numbered lists (1., 2., 3.) and bullet points (-)
      
      Make your response informative, accurate, and helpful for plant owners.
    `;

    // Create messages for the API
    const messages = [
      { role: 'system', content: PLANT_DETAILS_SYSTEM_PROMPT },
      { role: 'user', content: `Please provide detailed information about ${plantName} ${scientificName ? `(${scientificName})` : ''}.` }
    ];

    // Create a ReadableStream that will stream the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Create the fetch request to OpenAI API
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: messages,
              temperature: 0.7,
              max_tokens: 1500,
              stream: true,
            }),
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
          }

          // Get the response body as a ReadableStream
          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          // Read the stream
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // Decode the chunk
            const chunk = decoder.decode(value, { stream: true });
            
            // Process the chunk (OpenAI sends data: [JSON] format)
            const lines = chunk.split('\n');
            for (const line of lines) {
              // Skip empty lines or "[DONE]" messages
              if (!line || line === 'data: [DONE]') continue;
              
              // Extract the JSON data
              if (line.startsWith('data: ')) {
                try {
                  const jsonData = JSON.parse(line.slice(6));
                  
                  // Extract the content from the delta
                  const content = jsonData.choices?.[0]?.delta?.content;
                  
                  // If there's content, send it to the client
                  if (content) {
                    controller.enqueue(new TextEncoder().encode(content));
                  }
                } catch (e) {
                  console.error('Error parsing JSON:', e);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error in streaming:', error);
          controller.enqueue(new TextEncoder().encode(`Error: ${error.message}`));
        } finally {
          controller.close();
        }
      }
    });

    // Return the stream as the response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error in plant-details-stream edge function:', error);
    
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
} 