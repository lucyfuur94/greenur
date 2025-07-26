import { Handler } from '@netlify/functions'
import busboy from 'busboy'
import * as fs from 'fs'
import * as path from 'path'
import { Readable } from 'stream'

// Import sharp dynamically to avoid TypeScript issues
const sharp = require('sharp')

const handler: Handler = async (event, context) => {
  console.log('[analyze-plant-gemini] Function started')
  
  // Set CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
  
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    console.log('[analyze-plant-gemini] Handling OPTIONS request')
    return {
      statusCode: 200,
      headers,
      body: '',
    }
  }
  
  if (!process.env.VITE_GEMINI_API_KEY) {
    console.error('[analyze-plant-gemini] Gemini API key is not configured')
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Gemini API key is not configured. Please set GEMINI_API_KEY environment variable.' })
    }
  }

  if (event.httpMethod !== 'POST') {
    console.log('[analyze-plant-gemini] Method not allowed:', event.httpMethod)
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    console.log('[analyze-plant-gemini] Processing POST request')
    
    const tmpdir = '/tmp'
    if (!fs.existsSync(tmpdir)) {
      fs.mkdirSync(tmpdir)
      console.log('[analyze-plant-gemini] Created tmp directory')
    }

    // Parse multipart form data
    const parseFormData = () => {
      return new Promise<{ filePath: string; originalName: string }>((resolve, reject) => {
        let filePath = ''
        let originalName = ''
        let fileWriteStream: fs.WriteStream | null = null

        console.log('[analyze-plant-gemini] Starting form data parsing')

        const bb = busboy({ 
          headers: event.headers as Record<string, string>,
          limits: {
            fileSize: 5 * 1024 * 1024, // 5MB limit
            files: 1
          }
        })

        bb.on('file', (fieldname: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
          console.log('[analyze-plant-gemini] File received:', {
            fieldname,
            filename: info.filename,
            mimeType: info.mimeType,
            encoding: info.encoding
          })
          
          const tmpPath = path.join(tmpdir, `${Date.now()}_${info.filename}`)
          filePath = tmpPath
          originalName = info.filename

          fileWriteStream = fs.createWriteStream(tmpPath)
          file.pipe(fileWriteStream)

          file.on('limit', () => {
            console.error('[analyze-plant-gemini] File size limit exceeded')
            if (fileWriteStream) {
              fileWriteStream.end()
              fs.unlinkSync(tmpPath)
            }
            reject(new Error('File size limit exceeded (5MB)'))
          })
        })

        bb.on('finish', () => {
          console.log('[analyze-plant-gemini] Form parsing finished')
          if (fileWriteStream) {
            fileWriteStream.end()
          }
          resolve({ filePath, originalName })
        })

        bb.on('error', (error: Error) => {
          console.error('[analyze-plant-gemini] Busboy error:', error)
          if (fileWriteStream) {
            fileWriteStream.end()
            if (filePath && fs.existsSync(filePath)) {
              fs.unlinkSync(filePath)
            }
          }
          reject(error)
        })

        // Create readable stream from request body
        if (event.body) {
          const stream = new Readable({
            read() {
              this.push(Buffer.from(event.body as string, event.isBase64Encoded ? 'base64' : 'utf8'))
              this.push(null)
            }
          })
          stream.pipe(bb)
        } else {
          reject(new Error('No request body'))
        }
      })
    }

    const { filePath, originalName } = await parseFormData()

    if (!filePath) {
      console.error('[analyze-plant-gemini] No file uploaded')
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No file uploaded' })
      }
    }

    console.log('[analyze-plant-gemini] File saved to:', filePath)
    
    // Check if file exists and get its size
    const fileStats = fs.statSync(filePath)
    console.log('[analyze-plant-gemini] File size:', fileStats.size, 'bytes')

    // Process and resize image
    console.log('[analyze-plant-gemini] Starting image processing with Sharp')
    let processedBuffer: Buffer
    
    try {
      processedBuffer = await sharp(filePath)
        .jpeg({ quality: 80 })
        .resize(500, 500, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .toBuffer()
      
      console.log('[analyze-plant-gemini] Image processed successfully, size:', processedBuffer.length, 'bytes')
    } catch (sharpError) {
      console.error('[analyze-plant-gemini] Sharp processing error:', sharpError)
      throw new Error(`Image processing failed: ${sharpError instanceof Error ? sharpError.message : 'Unknown error'}`)
    }

    // Convert to base64 for Gemini API
    const base64Image = processedBuffer.toString('base64')
    console.log('[analyze-plant-gemini] Base64 conversion complete, length:', base64Image.length)

    // Call Gemini API
    console.log('[analyze-plant-gemini] Calling Gemini API')
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.VITE_GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `Analyze this plant image and provide ONLY the following information in valid JSON format:
{
  "commonName": "Common name of the plant in English",
  "scientificName": "Scientific/botanical name in Latin",
  "plantType": "Type category (e.g., succulent, herb, tree, flower, vegetable, etc.)"
}

Be as accurate as possible with plant identification. If you cannot identify with confidence, use "Unknown Plant" for commonName and "Species unknown" for scientificName.`
            },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: base64Image
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 150,
          topP: 0.8,
          topK: 40
        }
      })
    })

    console.log('[analyze-plant-gemini] Gemini API response status:', geminiResponse.status)

    if (!geminiResponse.ok) {
      const error = await geminiResponse.json().catch(() => ({}))
      console.error('[analyze-plant-gemini] Gemini API error:', error)
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${JSON.stringify(error)}`)
    }

    const geminiData = await geminiResponse.json()
    console.log('[analyze-plant-gemini] Gemini response data:', JSON.stringify(geminiData, null, 2))
    
    // Extract text from Gemini response
    const responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!responseText) {
      console.error('[analyze-plant-gemini] No response text from Gemini')
      throw new Error('No response from Gemini API')
    }

    console.log('[analyze-plant-gemini] Gemini response text:', responseText)

    // Parse JSON from response
    let analysis
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0])
        console.log('[analyze-plant-gemini] Parsed analysis:', analysis)
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('[analyze-plant-gemini] Failed to parse Gemini response:', parseError)
      // Fallback response
      analysis = {
        commonName: "Unknown Plant",
        scientificName: "Species unknown",
        plantType: "Unknown"
      }
    }

    // Clean up temporary file
    try {
      fs.unlinkSync(filePath)
      console.log('[analyze-plant-gemini] Temporary file cleaned up')
    } catch (cleanupError) {
      console.warn('[analyze-plant-gemini] Failed to cleanup temp file:', cleanupError)
    }

    console.log('[analyze-plant-gemini] Function completed successfully')
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ analysis })
    }

  } catch (error) {
    console.error('[analyze-plant-gemini] Function error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to process image',
        details: error instanceof Error ? error.stack : undefined
      })
    }
  }
}

export { handler } 