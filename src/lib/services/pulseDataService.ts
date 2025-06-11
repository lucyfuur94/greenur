import { auth } from '@/lib/firebase';

interface PulseDataPoint {
  _id: string;
  deviceId: string;
  timestamp: string;
  lightLevel?: number;
  temperature?: number;
  humidity?: number;
  soilMoisture?: number;
  sourceIp?: string;
}

interface PulseDataResponse {
  success: boolean;
  data?: PulseDataPoint[];
  error?: string;
}

const API_BASE_URL = '/.netlify/functions';

/**
 * Fetch pulse data for a specific device
 */
export async function getPulseData(deviceId: string, startDate?: Date, endDate?: Date): Promise<PulseDataResponse> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    const idToken = await currentUser.getIdToken();
    
    // Build query parameters
    let queryParams = `deviceId=${encodeURIComponent(deviceId)}`;
    
    // Add date parameters if provided
    // Convert local dates to UTC for MongoDB query (assuming data is stored in UTC)
    if (startDate) {
      // For IST (UTC+5:30), convert local time to UTC
      // Example: "2025-06-10T00:00:00 IST" becomes "2025-06-09T18:30:00.000Z UTC"
      queryParams += `&startDate=${encodeURIComponent(startDate.toISOString())}`;
    }
    if (endDate) {
      // Convert local time to UTC
      queryParams += `&endDate=${encodeURIComponent(endDate.toISOString())}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/get-pulse-data?${queryParams}`, {
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
        error: `Failed to fetch data: ${response.status} ${errorData}` 
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      data: data
    };

  } catch (error) {
    console.error('Error fetching pulse data:', error);
    return { 
      success: false, 
      error: 'Failed to fetch pulse data. Please try again.' 
    };
  }
}

/**
 * Get the latest data point for a device
 */
export async function getLatestPulseData(deviceId: string): Promise<PulseDataPoint | null> {
  const response = await getPulseData(deviceId);
  if (response.success && response.data && response.data.length > 0) {
    return response.data[0]; // Data is sorted by timestamp descending
  }
  return null;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString();
}

/**
 * Get relative time (e.g., "2 minutes ago")
 */
export function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
} 