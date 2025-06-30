import { Handler } from '@netlify/functions';

const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  if (!process.env.GEMINI_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Gemini API key not configured' })
    };
  }

  try {
    const { imageUrl, plantType, scientificName, commonName } = JSON.parse(event.body || '{}');

    if (!imageUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Image URL is required' })
      };
    }

    // Fetch the image to convert to base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Failed to fetch image');
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    // Define growth stages for the plant type
    const getGrowthStages = (type: string) => {
      const stageDefinitions: Record<string, string[]> = {
        'tomato': ['germination', 'seedling', 'vegetative_growth', 'flowering', 'fruiting', 'ripening'],
        'pepper': ['germination', 'seedling', 'vegetative_growth', 'flowering', 'fruiting', 'ripening'],
        'lettuce': ['germination', 'seedling', 'vegetative_growth', 'maturity'],
        'basil': ['germination', 'seedling', 'vegetative_growth', 'harvest'],
        'sunflower': ['germination', 'seedling', 'vegetative_growth', 'budding', 'flowering', 'seed_maturation'],
        'aloe': ['propagation', 'establishment', 'juvenile_growth', 'maturity'],
        'default': ['germination', 'seedling', 'vegetative_growth', 'flowering', 'maturity']
      };
      
      return stageDefinitions[type.toLowerCase()] || stageDefinitions['default'];
    };

    const expectedStages = getGrowthStages(plantType || 'default');
    const stagesString = expectedStages.join(', ');
    
    // Get today's date for the LLM to know what "today" is
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    const prompt = `Analyze this ${commonName} (${scientificName}) plant image and provide detailed analysis in JSON format.

Plant Type: ${plantType}
Expected Growth Stages: ${stagesString}
Current Date (Today): ${today}

Analyze the image and provide the following information in EXACTLY this JSON format:

{
  "healthStatus": {
    "status": "Healthy|Good|Needs Attention|Unhealthy",
    "reason": "Brief explanation of why the plant has this health status"
  },
  "currentStage": {
    "stageName": "one of: ${stagesString}",
    "stageDisplayName": "properly formatted stage name (e.g., 'Vegetative Growth', 'Flowering Stage')",
    "estimatedLifeDays": number (estimated total days since planting - current plant age),
    "currentStageStartDays": number (estimated days when current stage started),
    "currentStageEndDays": number (estimated days when current stage will end),
    "daysIntoStage": number (days passed since current stage started),
    "stageDurationDays": number (total duration of current stage),
    "stageProgressPercent": number (percentage completed in current stage: 0-100),
    "daysLeftInStage": number (estimated days remaining in current stage),
    "nextStageName": "name of the next growth stage",
    "nextStageDisplayName": "properly formatted next stage name"
  },
  "careInstructions": {
    "light_requirement": "specific light needs for current stage",
    "water_requirement": "specific watering guidance for current stage", 
    "soil_type": "soil requirements and drainage needs",
    "suitable_temperature": "optimal temperature range in Celsius only (e.g., 18-24°C)",
    "fertilizer": "fertilizer type and frequency for current stage",
    "common_diseases": "potential diseases/pests to watch for in this stage"
  },
  "nextCheckupDate": "YYYY-MM-DD format, 5-14 days from today based on stage",
  "actionItems": [
    {
      "task": "specific actionable task",
      "priority": "high|medium|low",
      "category": "watering|fertilizing|pruning|monitoring|pest_control|general",
      "dueDate": "YYYY-MM-DD format (within next checkup period)"
    }
  ]
}

Guidelines:
- Analyze the plant's visual health: look for leaf color, wilting, spots, pests, overall vigor
- Health status should be based on visual appearance:
  * Healthy: vibrant green leaves, strong stems, no visible issues
  * Good: mostly healthy with minor issues or normal aging
  * Needs Attention: yellowing leaves, spots, or other concerning signs
  * Unhealthy: severe wilting, disease, pest damage, or dying
- Provide a clear, specific reason for the health status (e.g., "Leaves show vibrant green color with good turgor pressure")
- Stage names should be properly formatted for display (e.g., "Vegetative Growth" not "vegetative_growth")
- Analyze plant appearance carefully to determine growth stage and age
- Consider leaf size, stem thickness, presence of flowers/buds, overall plant size
- Provide realistic stage timing calculations:
  * currentStageStartDays: when you estimate this stage began
  * currentStageEndDays: when you estimate this stage will end
  * daysIntoStage: how many days into the current stage
  * stageDurationDays: total length of current stage
  * stageProgressPercent: (daysIntoStage / stageDurationDays) * 100
- Provide stage-specific care instructions, not generic ones
- IMPORTANT: Always provide temperature in Celsius only (never Fahrenheit)
- Action items should be 3-5 simple, specific tasks for the current stage
- Assign realistic priorities: high (urgent/time-sensitive), medium (important), low (nice-to-have)
- Categories help organize tasks: watering, fertilizing, pruning, monitoring, pest_control, general
- Due dates should be within the next checkup period
- Next checkup should be appropriate for the growth stage (more frequent for early stages)
- Be realistic about plant age estimation based on visual appearance
- Include the next expected growth stage information`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Image
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1000,
            topP: 0.8,
            topK: 40
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const error = await geminiResponse.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${geminiResponse.status} - ${JSON.stringify(error)}`);
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('No response from Gemini API');
    }

    // Extract JSON from response
    let analysisResult;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError);
      console.log('Raw response:', responseText);
      
      // Fallback analysis
      analysisResult = {
        healthStatus: {
          status: 'Good',
          reason: 'Unable to analyze image, but assuming normal health'
        },
        currentStage: {
          stageName: expectedStages[1] || 'vegetative_growth',
          stageDisplayName: 'Vegetative Growth',
          estimatedLifeDays: 30,
          currentStageStartDays: 14,
          currentStageEndDays: 45,
          daysIntoStage: 16,
          stageDurationDays: 31,
          stageProgressPercent: 52,
          daysLeftInStage: 15,
          nextStageName: expectedStages[2] || 'flowering',
          nextStageDisplayName: 'Flowering Stage'
        },
        careInstructions: {
          light_requirement: 'Bright, indirect light for 6-8 hours daily',
          water_requirement: 'Water when top inch of soil feels dry',
          soil_type: 'Well-draining potting mix',
          suitable_temperature: '18-24°C',
          fertilizer: 'Balanced liquid fertilizer every 2 weeks',
          common_diseases: 'Watch for aphids, spider mites, and fungal issues'
        },
        nextCheckupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        actionItems: [
          {
            task: 'Check soil moisture and water if needed',
            priority: 'high',
            category: 'watering',
            dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          },
          {
            task: 'Inspect leaves for pests or disease signs',
            priority: 'medium',
            category: 'monitoring',
            dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          },
          {
            task: 'Ensure adequate light exposure',
            priority: 'medium',
            category: 'general',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
        ]
      };
    }

    // Validate and sanitize the response
    if (!analysisResult.nextCheckupDate) {
      const daysToAdd = Math.min(Math.max(analysisResult.currentStage?.daysLeftInStage || 7, 5), 14);
      analysisResult.nextCheckupDate = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    if (!Array.isArray(analysisResult.actionItems) || analysisResult.actionItems.length === 0) {
      analysisResult.actionItems = [
        {
          task: 'Monitor plant health and growth progress',
          priority: 'medium',
          category: 'monitoring',
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        {
          task: 'Check soil moisture levels regularly',
          priority: 'high',
          category: 'watering',
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      ];
    }

    // Ensure action items have the correct structure
    analysisResult.actionItems = analysisResult.actionItems.map((item: any) => {
      if (typeof item === 'string') {
        // Convert old string format to new object format
        return {
          task: item,
          priority: 'medium',
          category: 'general',
          dueDate: analysisResult.nextCheckupDate
        };
      }
      return item;
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(analysisResult)
    };

  } catch (error) {
    console.error('Error in analyze-plant-detailed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Analysis failed',
        details: 'Please try again or contact support if the issue persists'
      })
    };
  }
};

export { handler }; 