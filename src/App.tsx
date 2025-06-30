import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import PlantDetailsPage from './pages/PlantDetailsPage';
import PlantsPage from './pages/PlantsPage';
import PlantLogsPage from './pages/PlantLogsPage';
import OnboardingFlow from './components/OnboardingFlow';
import { useAuth } from './lib/AuthContext';
import { useOnboarding } from './lib/OnboardingContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AuthLandingPage from './pages/AuthLandingPage';
import TrackPage from './pages/TrackPage';
import { useEffect, useState } from 'react';


function App() {
  const { currentUser, loading: authLoading } = useAuth();
  const { isOnboardingComplete, userPreferences } = useOnboarding();
  const navigate = useNavigate();
  const [checkingPreferences, setCheckingPreferences] = useState(true);
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);

  // Check if we should show onboarding when user preferences load
  useEffect(() => {
    if (authLoading || !currentUser) {
      return;
    }
    
    // Add a small delay to ensure preferences have loaded
    setTimeout(() => {
      const onboardingComplete = isOnboardingComplete();
      const wasSkipped = userPreferences?.skippedOnboarding || false;
      
      console.log('Onboarding state check:', {
        onboardingComplete,
        wasSkipped,
        userPreferencesLoaded: !!userPreferences
      });
      
      setShouldShowOnboarding(!onboardingComplete && !wasSkipped);
      setCheckingPreferences(false);
    }, 300);
  }, [authLoading, currentUser, userPreferences, isOnboardingComplete]);

  // If still loading auth or checking preferences, show a simple loading screen
  if (authLoading || (currentUser && checkingPreferences)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // If not authenticated, redirect to sign in
  if (!currentUser) {
    return (
      <Routes>
        <Route path="/" element={<AuthLandingPage onNavigate={(page) => navigate(`/${page}`)} />} />
        <Route path="/auth" element={<AuthLandingPage onNavigate={(page) => navigate(`/${page}`)} />} />
        <Route path="/signin" element={<LoginPage onNavigate={(page) => navigate(`/${page}`)} onBack={() => navigate('/auth')} />} />
        <Route path="/login" element={<Navigate to="/signin" replace />} />
        <Route path="/signup" element={<SignupPage onNavigate={(page) => navigate(`/${page}`)} onBack={() => navigate('/auth')} />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage onNavigate={(page) => navigate(`/${page}`)} onBack={() => navigate('/signin')} />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  // If authenticated but onboarding not completed and not skipped, show onboarding flow
  if (shouldShowOnboarding) {
    return (
      <Routes>
        <Route path="/onboarding" element={<OnboardingFlow onComplete={() => navigate('/home')} />} />
        <Route path="/onboarding/:step" element={<OnboardingFlow onComplete={() => navigate('/home')} />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  // If authenticated and onboarding completed or skipped, show main app
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<HomePage onNavigate={(page) => navigate(`/${page}`)} />} />
      <Route path="/plants" element={<PlantsPage />} />
      <Route path="/plant-logs/:plantId" element={<PlantLogsPage />} />
      <Route path="/profile" element={<ProfilePage onBack={() => navigate('/home')} />} />
      <Route path="/track" element={<TrackPage />} />
      <Route path="/plant/:plantId" element={<PlantDetailsPage />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

export default App;
