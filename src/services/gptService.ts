import type { PlantAnalysis } from '../types/plant';
import { env } from '../config/env';

export async function analyzePlantImage(file: File): Promise<PlantAnalysis> {
  const formData = new FormData();
  formData.append('image', file);

  const apiKey = env.VITE_OPENAI_API_KEY;

  const response = await fetch('/.netlify/functions/analyze-plant', {
    method: 'POST',
    body: formData
  });

  const data = await response.json();
  return data.analysis;
} 