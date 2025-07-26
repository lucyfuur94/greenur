// Botanist Chat Generic Stream Edge Function
// Supports both OpenAI and Gemini models

export default async (request, context) => {
  // Add detailed logging for debugging
  console.log(`BOTANIST-CHAT-GENERIC-STREAM FUNCTION CALLED: ${Date.now()}: ${request.url}`);
  console.log(`Request method: ${request.method}`);
  console.log(`Request headers: ${JSON.stringify([...request.headers])}`);
  
  // Log environment variables for debugging
  console.log('Environment variables in botanist-chat-generic-stream:');
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

  try {
    // Parse the request body
    const body = await request.json();
    const { messages, modelId, locationData, weatherData } = body;
    
    console.log(`Model ID: ${modelId}`);
    console.log('Request includes locationData:', !!locationData);
    console.log('Request includes weatherData:', !!weatherData);

    // Validate required parameters
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid request: messages array is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Determine which model type to use and get API keys
    const modelType = modelId?.startsWith('gemini-') ? 'gemini' : 'openai';
    console.log(`Model type: ${modelType}`);
    let apiKey;
    
    // Get API key based on model type
    if (modelType === 'openai') {
      // Get OpenAI API key from environment variables
      if (typeof Deno !== 'undefined' && Deno.env) {
        apiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("VITE_OPENAI_API_KEY");
      }
      
      // For local development with Netlify CLI
      if (!apiKey && context && context.env) {
        apiKey = context.env.OPENAI_API_KEY || context.env.VITE_OPENAI_API_KEY;
      }
      
      // For Node.js environments
      if (!apiKey && typeof process !== 'undefined' && process.env) {
        apiKey = process.env.VITE_OPENAI_API_KEY;
      }
      
      if (!apiKey) {
        console.error('OpenAI API key is not configured in environment variables');
        return new Response(JSON.stringify({ 
          error: 'OpenAI API key is not configured'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    } else {
      // Get Gemini API key from environment variables
      if (typeof Deno !== 'undefined' && Deno.env) {
        apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("VITE_GEMINI_API_KEY");
      }
      
      // For local development with Netlify CLI
      if (!apiKey && context && context.env) {
        apiKey = context.env.GEMINI_API_KEY || context.env.VITE_GEMINI_API_KEY;
      }
      
      // For Node.js environments
      if (!apiKey && typeof process !== 'undefined' && process.env) {
        apiKey = process.env.VITE_GEMINI_API_KEY;
      }
      
      if (!apiKey) {
        console.error('Gemini API key is not configured in environment variables');
        return new Response(JSON.stringify({ 
          error: 'Gemini API key is not configured'
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // System prompt to instruct the AI to act as a botanist
    let BOTANIST_SYSTEM_PROMPT = `
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
    
    // Add location data to the system prompt if available
    if (locationData) {
      BOTANIST_SYSTEM_PROMPT += `\n\nUser Location Information:
      - City: ${locationData.city || 'Unknown'}
      - Country: ${locationData.country || 'Unknown'}
      - Location: ${locationData.lat ? `${locationData.lat}, ${locationData.lon}` : 'Unknown coordinates'}
      `;
    }
    
    // Add weather data to the system prompt if available
    if (weatherData) {
      BOTANIST_SYSTEM_PROMPT += `\n\nCurrent Weather Conditions:
      - Temperature: ${weatherData.temp || 'Unknown'} °C
      - Humidity: ${weatherData.humidity || 'Unknown'}%
      - Weather Condition: ${weatherData.condition || 'Unknown'}
      `;
      
      // Add hourly forecast if available
      if (weatherData.hourlyForecast && Array.isArray(weatherData.hourlyForecast) && weatherData.hourlyForecast.length > 0) {
        BOTANIST_SYSTEM_PROMPT += `\n\nHourly Forecast for Today:`;
        weatherData.hourlyForecast.forEach((hour) => {
          BOTANIST_SYSTEM_PROMPT += `\n- ${hour.time}: ${hour.temp || 'Unknown'} °C, ${hour.condition || 'Unknown'}`;
        });
      }
      
      // Add 3-day forecast if available (excluding today)
      if (weatherData.forecast && Array.isArray(weatherData.forecast) && weatherData.forecast.length > 0) {
        BOTANIST_SYSTEM_PROMPT += `\n\nWeather Forecast (Next 3 Days):`;
        weatherData.forecast.forEach((day, index) => {
          const dayName = index === 0 ? 'Tomorrow' : new Date(day.date).toLocaleDateString('en-US', { weekday: 'long' });
          BOTANIST_SYSTEM_PROMPT += `\n- ${dayName}: ${day.min || 'Unknown'}-${day.max || 'Unknown'} °C, ${day.condition || 'Unknown'}`;
        });
      }
    }

    // Add system message to the beginning if not already present
    const messagesWithSystem = messages[0]?.role === 'system' 
      ? messages 
      : [{ role: 'system', content: BOTANIST_SYSTEM_PROMPT }, ...messages];

    // Create a ReadableStream that will stream the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          if (modelType === 'openai') {
            // Handle OpenAI streaming
            await handleOpenAIStreaming(controller, apiKey, messagesWithSystem, modelId || 'gpt-4o-mini');
          } else {
            // Handle Gemini streaming
            await handleGeminiStreaming(controller, apiKey, messagesWithSystem, modelId || 'gemini-2.0-flash-lite');
          }
        } catch (error) {
          console.error(`Error in ${modelType} streaming:`, error);
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
    console.error('Error in botanist-chat-generic-stream edge function:', error);
    
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

// OpenAI streaming handler
async function handleOpenAIStreaming(controller, apiKey, messages, modelId) {
  // Create the fetch request to OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: messages,
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
}

// Gemini streaming handler
async function handleGeminiStreaming(controller, apiKey, messages, modelId) {
  // Use the provided model ID or default to gemini-2.0-flash-lite
  const model = modelId || 'gemini-2.0-flash-lite';
  console.log(`Using Gemini model: ${model}`);
  
  // Create URL with the API key
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;
  
  // Check if messages are already in Gemini format
  const isGeminiFormat = messages.some(msg => msg.parts !== undefined);
  
  // Build Gemini request body
  let geminiContents;
  
  if (isGeminiFormat) {
    // Messages are already in Gemini format, use them directly
    // But first filter out system messages which Gemini doesn't support
    geminiContents = messages.filter(msg => msg.role !== 'system');
    console.log('Using pre-formatted Gemini messages');
    
    // Log if there's any image content
    const hasImages = geminiContents.some(msg => 
      msg.parts && msg.parts.some(part => part.inline_data)
    );
    console.log('Messages contain images:', hasImages);
    
    // Log sample of first multimodal message if it exists
    if (hasImages) {
      const imageMessage = geminiContents.find(msg => 
        msg.parts && msg.parts.some(part => part.inline_data)
      );
      if (imageMessage) {
        console.log('First image message role:', imageMessage.role);
        console.log('Image parts count:', imageMessage.parts?.length);
        const imagePart = imageMessage.parts?.find(part => part.inline_data);
        if (imagePart?.inline_data) {
          console.log('Image MIME type:', imagePart.inline_data.mime_type);
          console.log('Base64 data length:', imagePart.inline_data.data ? imagePart.inline_data.data.substring(0, 20) + '...' : 'None');
        }
      }
    }
  } else {
    // Convert OpenAI chat format to Gemini format
    // Gemini doesn't have a system role, so we need to include it in a different way
    const systemMessage = messages.find(msg => msg.role === 'system')?.content || '';
    
    // Build chat history - Gemini uses a different structure for chat history
    geminiContents = [];
    let currentRole = null;
    let currentParts = [];
    
    // Process all messages except system message
    for (const message of messages) {
      if (message.role === 'system') continue; // Skip system message, we'll handle it separately
      
      // Map OpenAI roles to Gemini roles
      const geminiRole = message.role === 'user' ? 'user' : 'model';
      
      // If we're switching roles, add the previous message
      if (currentRole && currentRole !== geminiRole && currentParts.length > 0) {
        geminiContents.push({
          role: currentRole,
          parts: currentParts
        });
        currentParts = [];
      }
      
      // Add the content for this message
      currentParts.push({
        text: message.role === 'user' && message === messages[messages.length - 1] && systemMessage 
          ? `${systemMessage}\n\n${message.content}` // Add system prompt to the last user message
          : message.content
      });
      
      // Update current role
      currentRole = geminiRole;
    }
    
    // Add the final message if there's any content
    if (currentParts.length > 0) {
      geminiContents.push({
        role: currentRole,
        parts: currentParts
      });
    }
    
    // For a single message case or if geminiContents is empty, ensure we have at least one message
    if (geminiContents.length === 0) {
      // If no regular messages, just use the system message as a user message
      geminiContents.push({
        role: 'user',
        parts: [{
          text: systemMessage || 'Hello'
        }]
      });
    }
  }
  
  console.log('Sending request to Gemini API with content count:', geminiContents.length);
  
  // For debugging, log a sanitized version of the request body
  const debugRequestBody = {
    contents: geminiContents.map(content => ({
      role: content.role,
      parts: content.parts?.map(part => {
        if (part.inline_data) {
          return { 
            inline_data: { 
              mime_type: part.inline_data.mime_type,
              // Only show truncated data for logging
              data: part.inline_data.data ? `${part.inline_data.data.substring(0, 20)}...` : 'None'
            } 
          };
        }
        return { text: part.text ? (part.text.length > 50 ? `${part.text.substring(0, 50)}...` : part.text) : undefined };
      })
    })),
    safetySettings: [{ category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 1000, topP: 0.8, topK: 40 }
  };
  
  console.log('Gemini API request body (sanitized):', JSON.stringify(debugRequestBody, null, 2));
  
  // Create the fetch request to Gemini API
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: geminiContents,
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
        topP: 0.8,
        topK: 40
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error('Gemini API error details:', JSON.stringify(error));
    throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
  }

  // Get the response body as a ReadableStream for proper streaming
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  // Read the stream in chunks and process each chunk
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    // Decode the chunk
    const chunk = decoder.decode(value, { stream: true });
    
    try {
      // Process the chunk - Gemini returns chunked JSON objects
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          // Each line should be a JSON object
          const jsonObj = JSON.parse(line);
          
          // Extract text from the JSON object
          if (jsonObj?.candidates?.[0]?.content?.parts) {
            for (const part of jsonObj.candidates[0].content.parts) {
              if (part.text) {
                controller.enqueue(new TextEncoder().encode(part.text));
              }
            }
          }
        } catch (jsonError) {
          // If we can't parse as JSON, try to extract text using regex
          const textMatches = line.match(/"text":\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g);
          if (textMatches) {
            for (const match of textMatches) {
              // Extract the text content
              const text = match.replace(/"text":\s*"/, '').replace(/"$/, '');
              // Unescape any escaped characters
              const unescapedText = text.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
              // Send the text to the client
              controller.enqueue(new TextEncoder().encode(unescapedText));
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing Gemini chunk:', error);
    }
  }
}

// We don't need the conversion function anymore since we're handling the messages directly
function convertToGeminiFormat(messages) {
  const userMessage = messages[messages.length - 1];
  return [{
    parts: [{
      text: userMessage.content
    }]
  }];
} 