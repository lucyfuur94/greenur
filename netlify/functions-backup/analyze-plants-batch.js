"use strict";
import busboy from 'busboy';
import OpenAI from 'openai';
import sharp from 'sharp';

// Initialize OpenAI API
const openai = new OpenAI({
    apiKey: process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY
});

// Process image with sharp
async function processImage(buffer) {
    try {
        // Get image metadata to determine format
        const metadata = await sharp(buffer).metadata();
        console.log(`[analyze-plants-batch] Image format: ${metadata.format}, size: ${buffer.length} bytes`);
        
        // Process the image - reduce size for batch processing
        const processedBuffer = await sharp(buffer)
            .jpeg({ quality: 65 }) // Reduce quality for batch processing
            .resize(250, 250, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .toBuffer();

        return {
            mime: 'image/jpeg',
            data: processedBuffer.toString('base64')
        };
    }
    catch (error) {
        console.error('[analyze-plants-batch] Image processing failed:', error);
        throw new Error('Failed to process image');
    }
}

// Analyze a single image
async function analyzeImage(imageBuffer, index) {
    try {
        const { mime, data } = await processImage(imageBuffer);
        
        console.log(`[analyze-plants-batch] Sending image ${index} to OpenAI, size: ${data.length * 0.75} bytes`);
        
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Using a smaller, faster model
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "Analyze this plant image and provide ONLY the following information in valid JSON format, nothing else:\n{\n  \"commonName\": \"Common name in English\",\n  \"scientificName\": \"Scientific/Latin name\"\n}"
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:${mime};base64,${data}`,
                                detail: "low" // Use lower detail for faster processing
                            }
                        }
                    ]
                }
            ],
            max_tokens: 100, // Reduce token count for faster response
            temperature: 0.1
        }, {
            timeout: 10000 // 10 second timeout
        });

        const analysisText = response.choices[0]?.message?.content;
        if (!analysisText) {
            throw new Error('No analysis received from OpenAI');
        }

        // Extract JSON from the response
        const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to extract JSON from response');
        }
        
        const jsonContent = jsonMatch[0];
        return JSON.parse(jsonContent);
    }
    catch (error) {
        console.error(`[analyze-plants-batch] Error analyzing image ${index}:`, error);
        // Return a placeholder for failed analyses instead of throwing
        return {
            commonName: "Unknown",
            scientificName: "Analysis failed",
            error: error instanceof Error ? error.message : "Unknown error"
        };
    }
}

export const handler = async (event, context) => {
    // Set a shorter timeout for the function
    context.callbackWaitsForEmptyEventLoop = false;
    
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: '',
        };
    }
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
    
    try {
        console.log('[analyze-plants-batch] Request headers:', JSON.stringify(event.headers));
        
        if (!event.body) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No request body' }),
            };
        }
        
        if (!event.headers['content-type']?.includes('multipart/form-data')) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Content type must be multipart/form-data' }),
            };
        }
        
        // Parse the multipart form data
        const bodyBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8');
        console.log('[analyze-plants-batch] Request body size:', bodyBuffer.length, 'bytes');
        
        // Collect all image buffers
        const imageBuffers = [];
        const fileNames = [];
        
        await new Promise((resolve, reject) => {
            const bb = busboy({
                headers: event.headers,
                limits: {
                    fileSize: 5 * 1024 * 1024, // 5MB limit per file
                    files: 10 // Maximum 10 files
                }
            });
            
            bb.on('file', (fieldname, file, info) => {
                console.log('[analyze-plants-batch] Processing file:', fieldname, info);
                
                // Check if the file is an image
                // Accept both standard image types and HEIC/HEIF (which may be converted client-side)
                const isImage = info.mimeType.startsWith('image/') ||
                    info.filename.toLowerCase().endsWith('.heic') ||
                    info.filename.toLowerCase().endsWith('.heif') ||
                    info.filename.toLowerCase().endsWith('.jpg') ||
                    info.filename.toLowerCase().endsWith('.jpeg') ||
                    info.filename.toLowerCase().endsWith('.png');
                
                if (!isImage) {
                    console.log('[analyze-plants-batch] Skipping non-image file:', info.mimeType, info.filename);
                    file.resume();
                    return;
                }
                
                const chunks = [];
                file.on('data', (chunk) => chunks.push(chunk));
                file.on('end', () => {
                    if (chunks.length > 0) {
                        const buffer = Buffer.concat(chunks);
                        console.log('[analyze-plants-batch] File collected, size:', buffer.length, 'bytes');
                        imageBuffers.push(buffer);
                        fileNames.push(info.filename);
                    }
                });
            });
            
            bb.on('field', (name, val) => {
                console.log('[analyze-plants-batch] Form field:', name, val);
            });
            
            bb.on('finish', () => {
                console.log('[analyze-plants-batch] Finished parsing form data.');
                if (imageBuffers.length === 0) {
                    // No valid image files were processed, but don't reject yet.
                    // The promise will resolve, and the main handler will return an appropriate response.
                }
                resolve(); 
            });

            bb.on('error', (err) => {
                console.error('[analyze-plants-batch] Busboy parsing error:', err);
                reject(new Error('Failed to parse multipart form data'));
            });
            
            bb.end(bodyBuffer);
        });
        
        console.log(`[analyze-plants-batch] Number of image buffers collected: ${imageBuffers.length}`);
        
        if (imageBuffers.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No valid image files found in the request.' }),
            };
        }

        const analysisPromises = imageBuffers.map((buffer, index) => analyzeImage(buffer, index));
        const results = await Promise.all(analysisPromises);

        const finalResults = results.map((result, index) => ({
            fileName: fileNames[index] || `image_${index + 1}`,
            ...result
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(finalResults),
        };
    }
    catch (error) {
        console.error('[analyze-plants-batch] Unhandled error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error instanceof Error ? error.message : 'An unexpected error occurred' }),
        };
    }
};
