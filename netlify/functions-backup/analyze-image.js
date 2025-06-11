"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeImage = analyzeImage;
const fs_1 = __importDefault(require("fs"));
const openai_1 = __importDefault(require("openai"));
// Initialize OpenAI API
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
/**
 * Analyzes a plant image using OpenAI's Vision API
 * @param imagePath Path to the image file
 * @returns Analysis results with plant identification and care information
 */
async function analyzeImage(imagePath) {
    try {
        // Read the image file as base64
        const imageBuffer = fs_1.default.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        // Prepare the prompt for plant identification and analysis
        const prompt = `
      Analyze this plant image and provide the following information:
      1. Common name of the plant
      2. Scientific name (Latin name)
      3. Plant type (e.g., succulent, herb, tree, etc.)
      4. Growth stage (if apparent)
      5. Growing conditions (light, water, soil preferences)
      6. Basic care plan
      7. Any visible problems or diseases
      8. Treatment recommendations for any problems

      Format your response as a JSON object with these fields:
      {
        "commonName": "string",
        "scientificName": "string",
        "plantType": "string",
        "growthStage": "string",
        "growingConditions": "string",
        "carePlan": "string",
        "problems": ["string"],
        "treatment": ["string"]
      }
      
      If you cannot identify the plant with certainty, provide your best guess and indicate your confidence level.
      If any information is not applicable or cannot be determined, use null for that field.
      Ensure your response is valid JSON.
    `;
        // Call OpenAI API with the image
        const response = await openai.chat.completions.create({
            model: "gpt-4-vision-preview",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`,
                                detail: "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1000,
        });
        // Extract the response text
        const responseText = response.choices[0]?.message?.content || '';
        // Parse the JSON response
        // Find JSON content within the response (in case there's additional text)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to extract JSON from response');
        }
        const jsonContent = jsonMatch[0];
        const analysisData = JSON.parse(jsonContent);
        return {
            commonName: analysisData.commonName || 'Unknown Plant',
            scientificName: analysisData.scientificName || 'Species unknown',
            plantType: analysisData.plantType || null,
            growthStage: analysisData.growthStage || null,
            growingConditions: analysisData.growingConditions || null,
            carePlan: analysisData.carePlan || null,
            problems: Array.isArray(analysisData.problems) ? analysisData.problems : null,
            treatment: Array.isArray(analysisData.treatment) ? analysisData.treatment : null
        };
    }
    catch (error) {
        console.error('Error analyzing image:', error);
        throw error;
    }
}
