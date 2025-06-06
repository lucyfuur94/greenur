// Botanist Chat Stream Edge Function
export default async (request, context) => {
  // Add detailed logging for debugging
  console.log(`BOTANIST-CHAT-STREAM FUNCTION CALLED: ${Date.now()}: ${request.url}`);
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
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request: messages array is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // System prompt to instruct the AI to act as a botanist
    const BOTANIST_SYSTEM_PROMPT = `
      You are Greenur's plant expert botanist assistant. Your role is to help users with their plant-related questions.
      
      You should:
      - Provide accurate, helpful information about plants, gardening, plant care, and related topics
      - Answer questions about plant identification, care requirements, troubleshooting plant problems, etc.
      - Be friendly, supportive, and encouraging to gardeners of all experience levels
      - Use scientific names when appropriate, but explain concepts in accessible language
      - If you're unsure about something, acknowledge the limits of your knowledge
      - ONLY answer questions related to plants, gardening, botany, and closely related topics
      - For non-plant related questions, politely explain that you're a plant specialist and can only help with plant-related topics
      - Format your responses using markdown for better readability (bold, italics, lists, etc.)
      - Use **bold** for emphasis and headings
      - Use *italics* for scientific names
      - Use proper numbered lists (1., 2., 3.) and bullet points (-)
      
      DO NOT:
      - Provide advice on non-plant topics
      - Engage in discussions about politics, controversial topics, or anything unrelated to plants
      - Generate harmful content of any kind
    `;

    // Add system message to the beginning if not already present
    const messagesWithSystem = messages[0]?.role === 'system' 
      ? messages 
      : [{ role: 'system', content: BOTANIST_SYSTEM_PROMPT }, ...messages];

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
              messages: messagesWithSystem,
              temperature: 0.7,
              max_tokens: 1000,
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
    console.error('Error in botanist-chat-stream edge function:', error);
    
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