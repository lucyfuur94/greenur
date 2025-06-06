import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface UserPreferences {
  name: string;
  gardenType: 'indoor' | 'outdoor' | 'both';
  experience: 'beginner' | 'intermediate' | 'expert';
  notifications: boolean;
}

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  onboardingCompleted: boolean;
  userPreferences: UserPreferences | null;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  onboardingCompleted: false,
  userPreferences: null,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setOnboardingCompleted(userData.onboardingCompleted || false);
            setUserPreferences(userData.preferences || null);
          } else {
            // Create a new user document
            const newUserData = {
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL,
              onboardingCompleted: false,
              createdAt: new Date().toISOString(),
              preferences: null
            };
            
            await setDoc(userRef, newUserData);
            setOnboardingCompleted(false);
            setUserPreferences(null);
          }
        } catch (error) {
          console.error('Error fetching/creating user data:', error);
          setOnboardingCompleted(false);
          setUserPreferences(null);
        }
      } else {
        setOnboardingCompleted(false);
        setUserPreferences(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    loading,
    onboardingCompleted,
    userPreferences,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 