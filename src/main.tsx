import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { AuthProvider } from './lib/AuthContext'
import { OnboardingProvider } from './lib/OnboardingContext'
import { Toaster } from '@/components/ui/toaster'
import SplashLoader from '@/components/ui/SplashLoader'

const Root = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    // Check if this is the first load of the application
    const hasLoadedBefore = localStorage.getItem('greenur_app_loaded');
    
    if (hasLoadedBefore) {
      setShowSplash(false);
      setIsFirstLoad(false);
    } else {
      // Mark that the app has been loaded
      localStorage.setItem('greenur_app_loaded', 'true');
    }
  }, []);

  if (showSplash && isFirstLoad) {
    return <SplashLoader onFinished={() => setShowSplash(false)} />;
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <OnboardingProvider>
          <App />
          <Toaster />
        </OnboardingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
