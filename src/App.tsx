import { ChakraProvider } from '@chakra-ui/react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Login } from './components/auth/Login'
import { SignUp } from './components/auth/SignUp'
import { Layout } from './components/layout/Layout'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Tracker } from './pages/Tracker'
import { Botanica } from './pages/Botanica'
import { Onboarding } from './pages/Onboarding'
import { Profile } from './pages/Profile'
import { Settings } from './pages/Settings'
import theme from './theme'
import { BotanicaSearch } from './pages/BotanicaSearch'
import { BotanicaPlant } from './pages/BotanicaPlant'

interface ProtectedRouteProps {
  children: React.ReactNode
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { currentUser } = useAuth()

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/" element={<Navigate to="/botanica" replace />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />
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
        path="/botanica/search"
        element={
          <ProtectedRoute>
            <Layout>
              <BotanicaSearch />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/botanica/plant/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <BotanicaPlant />
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
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <Profile />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Layout>
              <Settings />
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
