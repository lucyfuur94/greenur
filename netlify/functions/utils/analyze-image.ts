import fs from 'fs';
import OpenAI from 'openai';
import sharp from 'sharp';

// Initialize OpenAI API
const openai = new OpenAI({
  apiKey: process.env.VITE_OPENAI_API_KEY
});

/**
 * Processes an image file for analysis
 * @param imagePath Path to the image file
 * @returns Processed image data
 */
async function processImageFile(imagePath: string): Promise<{ mime: string; data: string }> {
  try {
    // Read the image file
    const imageBuffer = fs.readFileSync(imagePath);
    
    // Get image metadata to determine format
    const metadata = await sharp(imageBuffer).metadata();
    console.log(`[analyze-image] Image format: ${metadata.format}, size: ${imageBuffer.length} bytes`);
    
    // Process the image
    const processedBuffer = await sharp(imageBuffer)
      .jpeg({ quality: 80 }) // Slightly reduce quality for faster processing
      .resize(400, 400, { // Reduce size while maintaining recognizable details
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer();

    return {
      mime: 'image/jpeg',
      data: processedBuffer.toString('base64')
    };
  } catch (error) {
    console.error('[analyze-image] Image processing failed:', error);
    throw new Error('Failed to process image');
  }
}

/**
 * Analyzes a plant image using OpenAI's Vision API
 * @param imagePath Path to the image file
 * @returns Analysis results with plant identification and care information
 */
export async function analyzeImage(imagePath: string): Promise<any> {
  try {
    // Process the image
    const { mime, data } = await processImageFile(imagePath);
    
    console.log(`[analyze-image] Sending image to OpenAI, size: ${data.length * 0.75} bytes`);
    
    // Call OpenAI API with the image
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using a smaller, faster model for batch processing
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

    // Extract the response text
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
  } catch (error) {
    console.error('[analyze-image] Error analyzing image:', error);
    return {
      commonName: "Unknown",
      scientificName: "Analysis failed",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
} 