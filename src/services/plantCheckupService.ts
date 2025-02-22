interface CheckupResult {
  stage: string;
  concerns: string[];
  carePlan: string[];
  nextCheckupDate: string;
  todoItems: string[];
}

interface PlantCheckup {
  plantId: string;
  userId: string;
  date: string;
  imageUrl: string;
  checkupResult: CheckupResult;
  completedTodos?: string[];
  growthAnalysis?: {
    rate: string;
    changes: string[];
  };
}

export const createCheckup = async (
  plantId: string,
  userId: string,
  imageUrl: string,
  previousImageUrl?: string
): Promise<PlantCheckup> => {
  try {
    const response = await fetch('/.netlify/functions/plant-checkup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        plantId,
        userId,
        imageUrl,
        previousImageUrl,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create plant checkup');
    }

    const data = await response.json();
    return data.checkup;
  } catch (error) {
    console.error('Error creating plant checkup:', error);
    throw error;
  }
};

export const getPlantCheckups = async (plantId: string): Promise<PlantCheckup[]> => {
  try {
    const response = await fetch(`/.netlify/functions/plant-checkup?plantId=${plantId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch plant checkups');
    }

    const data = await response.json();
    return data.checkups;
  } catch (error) {
    console.error('Error fetching plant checkups:', error);
    throw error;
  }
}; 