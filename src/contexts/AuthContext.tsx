import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from 'firebase/auth'
import { auth, db } from '../config/firebase'
import { doc, getDoc } from 'firebase/firestore'

interface UserPreferences {
  name: string
  experience: 'beginner' | 'intermediate' | 'expert'
  interests: string[]
  gardenType: 'indoor' | 'outdoor' | 'both'
  notifications: boolean
  location?: {
    latitude: number
    longitude: number
    city?: string
    country?: string
    timezone: string
  }
}

interface AuthContextType {
  currentUser: User | null
  loading: boolean
  onboardingCompleted: boolean
  userPreferences: UserPreferences | null
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  onboardingCompleted: false,
  userPreferences: null,
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user)
      
      if (user) {
        try {
          // Fetch user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            setOnboardingCompleted(userData.onboardingCompleted || false)
            setUserPreferences(userData.preferences || null)
          } else {
            // New user - initialize with default values
            setOnboardingCompleted(false)
            setUserPreferences(null)
          }
        } catch (error) {
          console.error('Error fetching user data:', error)
          // Don't let Firestore errors block the auth state
          setOnboardingCompleted(false)
          setUserPreferences(null)
        }
      } else {
        // No user - reset states
        setOnboardingCompleted(false)
        setUserPreferences(null)
      }
      
      setLoading(false)
    })

    return unsubscribe
  }, [])

  const value = {
    currentUser,
    loading,
    onboardingCompleted,
    userPreferences,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
} 