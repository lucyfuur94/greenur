import { auth } from '@/lib/firebase';

interface DeviceStatusResponse {
  success: boolean;
  status?: 'online' | 'recent' | 'offline' | 'no_data';
  online?: boolean;
  message?: string;
  lastSeen?: string;
  lastSeenFormatted?: string;
  totalDataPoints?: number;
  latestReading?: {
    lightLevel?: number;
    temperature?: number;
    humidity?: number;
    soilMoisture?: number;
  };
  error?: string;
}

const API_BASE_URL = '/.netlify/functions';

/**
 * Check if a pulse device is online and get its status
 */
export async function checkDeviceStatus(deviceId: string): Promise<DeviceStatusResponse> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    const idToken = await currentUser.getIdToken();
    
    const response = await fetch(`${API_BASE_URL}/check-device-status?deviceId=${encodeURIComponent(deviceId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      return { 
        success: false, 
        error: `Failed to check device status: ${response.status} ${errorData}` 
      };
    }

    const data = await response.json();
    return {
      success: true,
      ...data
    };

  } catch (error) {
    console.error('Error checking device status:', error);
    return { 
      success: false, 
      error: 'Failed to check device status. Please try again.' 
    };
  }
}

/**
 * Get a human-readable status message with color coding
 */
export function getStatusDisplay(status: string) {
  switch (status) {
    case 'online':
      return { 
        text: 'Online', 
        color: 'text-green-600', 
        bgColor: 'bg-green-50',
        description: 'Device is actively sending data (< 1 minute)'
      };
    case 'recent':
      return { 
        text: 'Recently Active', 
        color: 'text-yellow-600', 
        bgColor: 'bg-yellow-50',
        description: 'Device was active within 1-5 minutes'
      };
    case 'offline':
      return { 
        text: 'Offline', 
        color: 'text-red-600', 
        bgColor: 'bg-red-50',
        description: 'Device has not sent data for more than 5 minutes'
      };
    case 'no_data':
      return { 
        text: 'No Data', 
        color: 'text-gray-600', 
        bgColor: 'bg-gray-50',
        description: 'Device has never sent data'
      };
    default:
      return { 
        text: 'Unknown', 
        color: 'text-gray-600', 
        bgColor: 'bg-gray-50',
        description: 'Status unknown'
      };
  }
} 