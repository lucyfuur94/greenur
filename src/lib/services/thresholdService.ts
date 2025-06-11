// Service for managing device threshold settings

interface UpdateThresholdResponse {
  success: boolean;
  error?: string;
  threshold?: number;
}

export const updateDeviceThreshold = async (deviceId: string, threshold: number): Promise<UpdateThresholdResponse> => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, error: 'No authentication token found' };
    }

    const response = await fetch('/.netlify/functions/update-device-threshold', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        deviceId,
        threshold,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to update threshold' };
    }

    return { success: true, threshold: data.threshold };
  } catch (error) {
    console.error('Error updating device threshold:', error);
    return { success: false, error: 'Network error occurred' };
  }
}; 