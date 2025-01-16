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