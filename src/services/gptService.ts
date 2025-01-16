import { auth } from '../config/firebase'

export interface PlantAnalysis {
  plantType: string
  growthStage: string
  growingConditions: string
  carePlan: string
}

export const analyzePlantImage = async (image: File | string): Promise<PlantAnalysis> => {
  try {
    // Get the current user's ID token
    const token = await auth.currentUser?.getIdToken()
    if (!token) {
      throw new Error('Not authenticated')
    }

    // Create form data or use URL
    let body: FormData | string
    if (image instanceof File) {
      const formData = new FormData()
      formData.append('image', image)
      body = formData
    } else {
      body = JSON.stringify({ imageUrl: image })
    }

    // Call the Netlify function
    const response = await fetch('/.netlify/functions/analyze-plant', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...(typeof image === 'string' && { 'Content-Type': 'application/json' })
      },
      body
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