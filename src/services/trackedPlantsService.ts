import type { TrackedPlant } from '../types/plant';

interface ImageHistory {
  url: string;
  timestamp: string;
}

interface MongoUpdateData {
  $set?: Partial<TrackedPlant>;
  $push?: {
    imageHistory: {
      url: string;
      timestamp: string;
    };
  };
}

export const addTrackedPlant = async (plant: Omit<TrackedPlant, '_id'>) => {
  try {
    const response = await fetch('/.netlify/functions/tracked-plants', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...plant,
        imageHistory: [{
          url: plant.currentImage,
          timestamp: new Date().toISOString()
        }]
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to add tracked plant');
    }

    return await response.json();
  } catch (error) {
    console.error('Error adding tracked plant:', error);
    throw error;
  }
};

export const getTrackedPlants = async (userId: string): Promise<TrackedPlant[]> => {
  try {
    const response = await fetch(`/.netlify/functions/tracked-plants?userId=${userId}`);
    if (!response.ok) {
      throw new Error('Failed to fetch tracked plants');
    }
    const data = await response.json();
    return Array.isArray(data) ? data : []; // Handle direct array response
  } catch (error) {
    console.error('Error fetching tracked plants:', error);
    throw error;
  }
};

export const updateTrackedPlant = async (id: string, updates: Partial<TrackedPlant>): Promise<void> => {
  try {
    // If updating the current image, add it to image history
    let updateData: MongoUpdateData = { $set: updates };
    if (updates.currentImage) {
      updateData.$push = {
        imageHistory: {
          url: updates.currentImage,
          timestamp: new Date().toISOString()
        }
      };
    }

    const response = await fetch(`/.netlify/functions/tracked-plants?id=${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update tracked plant');
    }
  } catch (error) {
    console.error('Error updating tracked plant:', error);
    throw error;
  }
};

export const deleteTrackedPlant = async (id: string): Promise<void> => {
  try {
    const response = await fetch(`/.netlify/functions/tracked-plants?id=${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete tracked plant');
    }
  } catch (error) {
    console.error('Error deleting tracked plant:', error);
    throw error;
  }
}; 