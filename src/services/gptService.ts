import type { PlantAnalysis } from '../types/plant';

export async function analyzePlantImage(file: File): Promise<PlantAnalysis> {
  const formData = new FormData();
  formData.append('image', file);

  try {
    console.log('Sending image for analysis...');
    const response = await fetch('/.netlify/functions/analyze-plant', {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      }
    });

    const data = await response.text(); // Get raw response text first
    console.log('Raw response:', data);

    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', data);
      throw new Error('Invalid response format from server');
    }

    if (!response.ok) {
      const errorMessage = jsonData.error || 'Failed to analyze plant image';
      console.error('Server error:', errorMessage);
      throw new Error(errorMessage);
    }

    if (!jsonData.analysis) {
      console.error('Missing analysis in response:', jsonData);
      throw new Error('Invalid response format from server');
    }

    // Ensure the response matches the expected PlantAnalysis type
    const analysis: PlantAnalysis = {
      commonName: jsonData.analysis.commonName || 'Unknown Plant',
      scientificName: jsonData.analysis.scientificName || 'Species unknown',
      plantType: jsonData.analysis.plantType,
      growthStage: jsonData.analysis.growthStage,
      growingConditions: jsonData.analysis.growingConditions,
      carePlan: jsonData.analysis.carePlan,
      problems: jsonData.analysis.problems,
      treatment: jsonData.analysis.treatment
    };

    return analysis;
  } catch (error) {
    console.error('Error analyzing plant image:', error);
    throw error instanceof Error ? error : new Error('Failed to analyze plant image');
  }
} 