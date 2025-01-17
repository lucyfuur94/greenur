import { Handler } from '@netlify/functions'
import OpenAI from 'openai'
import sharp from 'sharp'

// Configure sharp for Netlify environment
sharp.cache(false)

// More detailed environment variable logging
console.log('Environment variables:', {
  hasOpenAIKey: !!process.env.OPENAI_API_KEY,
  keyLength: process.env.OPENAI_API_KEY?.length,
  nodeEnv: process.env.NODE_ENV,
  sharpVersion: sharp.versions
})

if (!process.env.OPENAI_API_KEY) {
  console.error('OpenAI API key is missing from environment variables')
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

async function resizeImage(base64Image: string): Promise<string> {
  try {
    // Remove data URL prefix if present
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')

    // Resize image with additional error handling
    const resizedImageBuffer = await sharp(imageBuffer, { 
      failOnError: false,
      limitInputPixels: false
    })
      .resize(150, 150, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toBuffer()
      .catch(err => {
        console.error('Sharp resize error:', err)
        return imageBuffer // Return original if resize fails
      })

    // Convert back to base64
    return `data:image/jpeg;base64,${resizedImageBuffer.toString('base64')}`
  } catch (error) {
    console.error('Error resizing image:', error)
    // Return original image if resize fails
    return base64Image
  }
}

const handler: Handler = async (event) => {
  if (!process.env.OPENAI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'OpenAI API key is not configured' })
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    let imageData: string

    // Handle form data (file upload)
    if (event.headers['content-type']?.includes('multipart/form-data')) {
      const formData = event.body
      if (!formData) {
        throw new Error('No image data received')
      }
      const base64Image = `data:image/jpeg;base64,${formData}`
      try {
        imageData = await resizeImage(base64Image)
      } catch (error) {
        console.error('Failed to resize image:', error)
        imageData = base64Image // Use original if resize fails
      }
    } 
    // Handle JSON data (image URL)
    else {
      const { imageUrl } = JSON.parse(event.body || '{}')
      if (!imageUrl) {
        throw new Error('No image URL received')
      }
      imageData = imageUrl
    }

    // Send to OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this plant image and provide the following details in JSON format:\n1. plantType: The type of plant (e.g., 'Flowering Plant', 'Succulent', etc.)\n2. growthStage: Current growth stage and health assessment\n3. growingConditions: Ideal growing conditions (light, water, soil, temperature)\n4. carePlan: Detailed care instructions and tips"
            } as const,
            {
              type: "image_url",
              image_url: { url: imageData }
            } as const
          ]
        }
      ],
      max_tokens: 1000
    })

    // Ensure the response is in JSON format
    let analysis
    try {
      analysis = JSON.parse(response.choices[0].message.content || '{}')
    } catch {
      // If parsing fails, return the raw text
      analysis = {
        error: "Failed to parse GPT response as JSON",
        rawResponse: response.choices[0].message.content
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(analysis)
    }
  } catch (error) {
    console.error('Error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to analyze plant image' 
      })
    }
  }
}

export { handler } 