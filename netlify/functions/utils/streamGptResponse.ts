import { Handler } from '@netlify/functions';
import OpenAI from 'openai';

// Common headers for streaming responses
export const streamHeaders = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Helper function to send a formatted SSE message
const sendSSE = (
  data: any, 
  event: string = 'message', 
  id?: string, 
  retry?: number
): string => {
  let message = '';
  
  if (id) message += `id: ${id}\n`;
  if (event) message += `event: ${event}\n`;
  if (retry) message += `retry: ${retry}\n`;
  
  message += `data: ${JSON.stringify(data)}\n\n`;
  
  return message;
};

// Function to process OpenAI streaming responses and return as SSE formatted string
export const processOpenAIStreamToSSE = async (
  openai: OpenAI,
  systemPrompt: string,
  userPrompt: string,
  model: string = 'gpt-4o-mini',
  temperature: number = 0.3,
  maxTokens: number = 800,
  responseProcessor?: (chunk: string) => any,
  onChunk?: (chunk: string) => void
): Promise<string> => {
  try {
    // Initial message
    let result = sendSSE({ status: 'started' }, 'start');
    
    if (onChunk) onChunk(result);
    
    // Create streaming response from OpenAI
    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature,
      max_tokens: maxTokens,
      stream: true,
    });
    
    let accumulatedResponse = '';
    let lastProcessedLength = 0;
    let updateCounter = 0;
    
    // Process each chunk as it arrives
    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        accumulatedResponse += content;
        updateCounter++;
        
        // Process and send updates more frequently - every 2 tokens or when we have a significant amount of new content
        const shouldUpdate = 
          updateCounter >= 2 || 
          (accumulatedResponse.length - lastProcessedLength) > 10 ||
          content.includes('}') || 
          content.includes(']') ||
          content.includes('"') ||
          content.includes(',');
        
        if (shouldUpdate) {
          updateCounter = 0;
          lastProcessedLength = accumulatedResponse.length;
          
          let chunkMessage = '';
          
          // If a custom processor is provided, use it
          if (responseProcessor) {
            try {
              const processedData = responseProcessor(accumulatedResponse);
              chunkMessage = sendSSE(processedData, 'chunk');
            } catch (error) {
              // If processing fails, just send the raw chunk
              chunkMessage = sendSSE({ text: content, raw: true }, 'chunk');
            }
          } else {
            // Default behavior: send the raw chunk
            chunkMessage = sendSSE({ text: content }, 'chunk');
          }
          
          result += chunkMessage;
          if (onChunk) onChunk(chunkMessage);
        }
      }
    }
    
    // Send completion message
    const completionMessage = sendSSE({ status: 'completed', fullText: accumulatedResponse }, 'complete');
    result += completionMessage;
    if (onChunk) onChunk(completionMessage);
    
    return result;
  } catch (error) {
    // Handle errors
    const errorMessage = sendSSE({ 
      status: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    }, 'error');
    
    if (onChunk) onChunk(errorMessage);
    return errorMessage;
  }
};

// Helper to create a streaming handler
export const createStreamingHandler = (
  requestValidator: (body: any) => any,
  promptGenerator: (input: any) => { systemPrompt: string; userPrompt: string },
  responseProcessor?: (chunk: string) => any
): Handler => {
  return async (event, context) => {
    // Disable waiting for empty event loop
    if (context) {
      context.callbackWaitsForEmptyEventLoop = false;
    }
    
    try {
      // Handle OPTIONS request for CORS
      if (event.httpMethod === 'OPTIONS') {
        return {
          statusCode: 204,
          headers: streamHeaders,
          body: ''
        };
      }
      
      // Check API key
      if (!process.env.VITE_OPENAI_API_KEY) {
        return {
          statusCode: 500,
          headers: streamHeaders,
          body: sendSSE({ 
            status: 'error', 
            message: 'OpenAI API key is not configured' 
          }, 'error')
        };
      }
      
      // Initialize OpenAI client
      const openai = new OpenAI({
        apiKey: process.env.VITE_OPENAI_API_KEY,
      });
      
      // Parse and validate request
      let input;
      try {
        input = requestValidator(JSON.parse(event.body || '{}'));
      } catch (error) {
        return {
          statusCode: 400,
          headers: streamHeaders,
          body: sendSSE({ 
            status: 'error', 
            message: error instanceof Error ? error.message : 'Invalid request' 
          }, 'error')
        };
      }
      
      // Generate prompts
      const { systemPrompt, userPrompt } = promptGenerator(input);
      
      // Process the stream and return as SSE
      const responseBody = await processOpenAIStreamToSSE(
        openai,
        systemPrompt,
        userPrompt,
        'gpt-4o-mini',
        0.3,
        800,
        responseProcessor
      );
      
      return {
        statusCode: 200,
        headers: streamHeaders,
        body: responseBody
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers: streamHeaders,
        body: sendSSE({ 
          status: 'error', 
          message: error instanceof Error ? error.message : 'Unknown error' 
        }, 'error')
      };
    }
  };
}; 