import type { PlantAnalysis } from '../types/plant';

export async function analyzePlantImage(file: File): Promise<PlantAnalysis> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch('/.netlify/functions/analyze-plant', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  return data.analysis;
} 