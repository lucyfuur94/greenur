import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { AuthProvider } from './lib/AuthContext'
import { OnboardingProvider } from './lib/OnboardingContext'
import { ThemeProvider } from './lib/ThemeContext'
import { Toaster } from '@/components/ui/toaster'
const Root = () => {

  return (
    <BrowserRouter>
      <AuthProvider>
        <OnboardingProvider>
          <ThemeProvider>
            <App />
            <Toaster />
          </ThemeProvider>
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
