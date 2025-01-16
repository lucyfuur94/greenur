import { auth } from '../config/firebase'

export interface PlantAnalysis {
  plantType: string
  growthStage: string
  growingConditions: string
  carePlan: string
}

export const analyzePlantImage = async (imageUrl: string): Promise<PlantAnalysis> => {
  try {
    // Get the current user's ID token
    const token = await auth.currentUser?.getIdToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    // Call the Netlify function
    const response = await fetch('/.netlify/functions/analyze-plant', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ imageUrl }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to analyze plant image')
    }

    const analysis = await response.json()
    return analysis
  } catch (error) {
    console.error('Error analyzing plant:', error)
    throw error
  }
} 