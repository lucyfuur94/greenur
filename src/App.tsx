import { ChakraProvider } from '@chakra-ui/react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Login } from './components/auth/Login'
import { Layout } from './components/layout/Layout'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Tracker } from './pages/Tracker'
import { Botanica } from './pages/Botanica'
import { Onboarding } from './pages/Onboarding'
import theme from './theme'
import { doc, getDoc } from 'firebase/firestore'
import { db } from './config/firebase'
import { useEffect, useState } from 'react'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { currentUser } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!currentUser) {
        setIsLoading(false)
        return
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
        setNeedsOnboarding(!userDoc.exists() || !userDoc.data()?.onboardingCompleted)
      } catch (error) {
        console.error('Error checking onboarding status:', error)
        setNeedsOnboarding(true)
      } finally {
        setIsLoading(false)
      }
    }

    checkOnboardingStatus()
  }, [currentUser])

  if (isLoading) {
    return null // Or a loading spinner
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/" element={<Navigate to="/botanica" replace />} />
      <Route
        path="/botanica"
        element={
          <ProtectedRoute>
            <Layout>
              <Botanica />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tracker"
        element={
          <ProtectedRoute>
            <Layout>
              <Tracker />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/connect"
        element={
          <ProtectedRoute>
            <Layout>
              <div>Connect with Plant Enthusiasts</div>
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/marketplace"
        element={
          <ProtectedRoute>
            <Layout>
              <div>Plant Marketplace</div>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function App() {
  return (
    <ChakraProvider theme={theme}>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ChakraProvider>
  )
}

export default App
