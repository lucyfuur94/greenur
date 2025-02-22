export interface UserLocation {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
  timezone: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  location?: UserLocation;
  preferences?: {
    notifications: boolean;
    emailUpdates: boolean;
    weatherAlerts: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  experience?: 'beginner' | 'intermediate' | 'expert';
  gardenType?: 'indoor' | 'outdoor' | 'greenhouse';
  interests?: string[];
  location?: string;
  currentWeather?: {
    temp: number;
    humidity: number;
    precipitation: number;
  } | null;
  forecast?: Array<{
    date: string;
    temp: number;
    condition: string;
  }> | null;
  createdAt?: string;
  updatedAt?: string;
} 