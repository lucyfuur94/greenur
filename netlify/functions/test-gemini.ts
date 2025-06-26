import { Handler } from '@netlify/functions'

const handler: Handler = async (event, context) => {
  console.log('[test-gemini] Test function started')
  
  // Set CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
  
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    }
  }
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('[test-gemini] Gemini API key is not configured')
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Gemini API key is not configured',
        hasKey: false,
        keyLength: 0
      })
    }
  }

  try {
    console.log('[test-gemini] Testing Gemini API connection')
    
    // Simple test prompt without image
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "Say 'Hello, Gemini API is working!' in JSON format: {\"message\": \"your response\"}"
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 50
        }
      })
    })

    console.log('[test-gemini] Gemini API response status:', geminiResponse.status)

    if (!geminiResponse.ok) {
      const error = await geminiResponse.json().catch(() => ({}))
      console.error('[test-gemini] Gemini API error:', error)
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: `Gemini API error: ${geminiResponse.status}`,
          details: error,
          hasKey: true,
          keyLength: process.env.GEMINI_API_KEY?.length || 0
        })
      }
    }

    const geminiData = await geminiResponse.json()
    console.log('[test-gemini] Gemini response:', geminiData)
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: 'Gemini API is working',
        hasKey: true,
        keyLength: process.env.GEMINI_API_KEY?.length || 0,
        response: geminiData
      })
    }

  } catch (error) {
    console.error('[test-gemini] Error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        hasKey: !!process.env.GEMINI_API_KEY,
        keyLength: process.env.GEMINI_API_KEY?.length || 0
      })
    }
  }
}

export { handler } 