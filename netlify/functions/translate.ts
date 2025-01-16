import { Handler } from '@netlify/functions'

const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY
const GOOGLE_TRANSLATE_ENDPOINT = 'https://translation.googleapis.com/language/translate/v2'

export const handler: Handler = async (event) => {
  if (!GOOGLE_TRANSLATE_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API key not configured' })
    }
  }

  const { text, target } = event.queryStringParameters || {}
  if (!text || !target) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Text and target language parameters are required' })
    }
  }

  try {
    const response = await fetch(
      `${GOOGLE_TRANSLATE_ENDPOINT}?key=${GOOGLE_TRANSLATE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: text,
          target: target,
          format: 'text'
        })
      }
    )

    if (!response.ok) {
      throw new Error(`Translation API responded with ${response.status}`)
    }

    const data = await response.json()
    return {
      statusCode: 200,
      body: JSON.stringify({
        translatedText: data.data.translations[0].translatedText,
        detectedSourceLanguage: data.data.translations[0].detectedSourceLanguage
      })
    }
  } catch (error) {
    console.error('Error translating text:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to translate text' })
    }
  }
} 