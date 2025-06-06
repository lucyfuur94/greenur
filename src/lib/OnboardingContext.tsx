import React, { createContext, useState, useContext, useEffect } from 'react';
import { UserPreferences, OnboardingContextType } from './types';
import { useAuth } from './AuthContext';
import { fetchUserPreferences, updateUserPreferences as updateUserPreferencesInDB } from './services/userPreferencesService';

const defaultPreferences: UserPreferences = {
  name: '',
  experience: 'beginner',
  gardenType: 'indoor',
  growingSpaces: [],
  interests: [],
  checkupFrequency: '',
  checkupDays: [],
  completedOnboarding: false,
  onboardingStep: 1,
  onboardingProgress: 20
};

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchPreferences = async () => {
      if (!currentUser) {
        setUserPreferences(null);
        setLoading(false);
        return;
      }

      try {
        console.log("Fetching user preferences for:", currentUser.uid);
        // Fetch user preferences from MongoDB
        const preferences = await fetchUserPreferences(currentUser.uid);
        
        if (preferences) {
          console.log("User preferences loaded:", JSON.stringify({
            completedOnboarding: preferences.completedOnboarding,
            skippedOnboarding: preferences.skippedOnboarding,
            onboardingStep: preferences.onboardingStep
          }));
          setUserPreferences(preferences);
        } else {
          // If no preferences found, use defaults
          console.log("No preferences found, using defaults");
          setUserPreferences(defaultPreferences);
        }
      } catch (error) {
        console.error('Error fetching user preferences:', error);
        setUserPreferences(defaultPreferences);
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [currentUser]);

  const updateUserPreferences = async (preferences: Partial<UserPreferences>) => {
    if (!currentUser || !userPreferences) return;

    try {
      console.log("Updating user preferences:", JSON.stringify(preferences));
      // Update preferences in MongoDB
      const updatedPreferences = await updateUserPreferencesInDB(
        currentUser.uid, 
        preferences
      );
      
      if (updatedPreferences) {
        console.log("User preferences updated successfully");
        setUserPreferences(updatedPreferences);
      }
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  };

  const isOnboardingComplete = () => {
    const completed = userPreferences?.completedOnboarding || false;
    console.log("Checking onboarding status:", {
      completedOnboarding: userPreferences?.completedOnboarding,
      skippedOnboarding: userPreferences?.skippedOnboarding
    });
    return completed;
  };

  return (
    <OnboardingContext.Provider
      value={{
        userPreferences,
        updateUserPreferences,
        isOnboardingComplete
      }}
    >
      {!loading && children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = (): OnboardingContextType => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}; 