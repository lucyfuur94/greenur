export interface PlantAnalysis {
  plantType: string
  growthStage: string
  growingConditions: string
  carePlan: string
}

export const analyzePlantImage = async (image: File | string): Promise<PlantAnalysis> => {
  try {
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
        ...(typeof image === 'string' && { 'Content-Type': 'application/json' })
      },
      body
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage: string
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error || 'Failed to analyze plant image'
      } catch {
        errorMessage = errorText || 'Failed to analyze plant image'
      }
      throw new Error(errorMessage)
    }

    const responseText = await response.text()
    try {
      const analysis = JSON.parse(responseText)
      return analysis
    } catch {
      throw new Error('Invalid response format from server')
    }
  } catch (error) {
    console.error('Error analyzing plant:', error)
    throw error
  }
} 