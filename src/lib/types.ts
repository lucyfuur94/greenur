export interface UserPreferences {
  name: string;
  experience: 'beginner' | 'intermediate' | 'expert';
  gardenType: 'indoor' | 'outdoor' | 'both';
  growingSpaces: GrowingSpace[];
  interests: string[];
  checkupFrequency: string;
  checkupDays: string[];
  firstPlant?: {
    plantName: string;
    plantId?: string;
    imageUrl?: string;
    growingSpaceId: string;
  };
  completedOnboarding: boolean;
  skippedOnboarding?: boolean;
  onboardingProgress?: number;
  onboardingStep?: number;
  lastUpdated?: string;
}

export interface GrowingSpace {
  id: string;
  name?: string;
  type: string;
}

export interface OnboardingContextType {
  userPreferences: UserPreferences | null;
  updateUserPreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  isOnboardingComplete: () => boolean;
}

export interface PlantItem {
  id: string;
  name: string;
  scientificName?: string;
  type?: string;
  image?: string;
} 