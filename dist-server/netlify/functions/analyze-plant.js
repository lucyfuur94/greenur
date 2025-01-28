import OpenAI from 'openai';
import { resizeImage } from './utils/imageProcessor';
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
const SYSTEM_PROMPT = `You are a plant identification and care expert. Analyze the plant image and provide:

1. Plant Type:
   - Scientific name
   - Common name
   - Category (e.g., flowering plant, succulent, vegetable, herb, etc.)
   - Family characteristics

2. Growth Stage:
   - Current stage (seedling, juvenile, mature, etc.)
   - Estimated age range
   - Signs of current growth phase

3. Growing Conditions Analysis:
   - Current setup assessment (pot size, soil type if visible)
   - Optimal pot size for current growth stage
   - Next pot upgrade timing if needed
   - Light requirements
   - Water requirements
   - Humidity needs
   - Temperature range
   - Soil type recommendations

4. Care Plan:
   - Watering schedule
   - Fertilization timing and type
   - Pruning needs
   - Repotting schedule
   - Common issues to watch for
   - Preventative care measures
   - Next major care tasks with timing

Format your response as a JSON object with these exact keys in order:
plantType, growthStage, growingConditions, carePlan.
Each field should be detailed but concise. Include specific measurements and timings where possible.`;
export const handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    try {
        // Parse request body
        const { imageUrl } = JSON.parse(event.body || '{}');
        if (!imageUrl) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Image URL is required' }),
            };
        }
        // Resize image before sending to GPT
        const resizedImageUrl = await resizeImage(imageUrl);
        // Call GPT-4 Vision API
        const response = await openai.chat.completions.create({
            model: "gpt-4-vision-preview",
            messages: [
                {
                    role: "system",
                    content: SYSTEM_PROMPT
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analyze this plant image and provide care instructions." },
                        {
                            type: "image_url",
                            image_url: {
                                url: resizedImageUrl
                            }
                        }
                    ]
                }
            ],
            max_tokens: 500,
        });
        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('No analysis received from GPT');
        }
        try {
            // Parse the JSON response
            const analysis = JSON.parse(content);
            return {
                statusCode: 200,
                body: JSON.stringify({
                    plantType: analysis.plantType || 'Unknown plant type',
                    growthStage: analysis.growthStage || 'Unknown growth stage',
                    growingConditions: analysis.growingConditions || 'No growing conditions provided',
                    carePlan: analysis.carePlan || 'No care plan provided'
                }),
            };
        }
        catch (parseError) {
            // If JSON parsing fails, try to extract information from the text response
            const lines = content.split('\n');
            return {
                statusCode: 200,
                body: JSON.stringify({
                    plantType: lines.find(l => l.includes('Type'))?.replace(/^[^:]+:/, '').trim() || 'Unknown plant type',
                    growthStage: lines.find(l => l.includes('Stage'))?.replace(/^[^:]+:/, '').trim() || 'Unknown growth stage',
                    growingConditions: lines.find(l => l.includes('Conditions'))?.replace(/^[^:]+:/, '').trim() || 'No growing conditions provided',
                    carePlan: lines.find(l => l.includes('Plan'))?.replace(/^[^:]+:/, '').trim() || 'No care plan provided'
                }),
            };
        }
    }
    catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to analyze plant image' }),
        };
    }
};
