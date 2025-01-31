import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { GlobalLoader } from './components/GlobalLoader.tsx';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { auth } from './config/firebase';

const Root = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing your green journey...');

  useEffect(() => {
    let isMounted = true;
    const criticalPromises: Promise<unknown>[] = [];
    const messages = [
      'Growing your plant database...',
      'Watering the digital plants...',
      'Preparing soil sensors...',
      'Setting up sunlight simulation...',
      'Initializing photosynthesis algorithms...'
    ];

    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      if (isMounted) {
        messageIndex = (messageIndex + 1) % messages.length;
        setLoadingMessage(messages[messageIndex]);
      }
    }, 2500);

    const initApp = async () => {
      try {
        setLoadingMessage('Connecting to plant network...');
        
        // Auth initialization
        criticalPromises.push(
          new Promise(resolve => {
            setLoadingMessage('Setting up secure session...');
            const unsubscribe = auth.onAuthStateChanged(user => {
              unsubscribe();
              resolve(null);
            });
          })
        );

        // Simulate other initializations
        criticalPromises.push(
          new Promise(resolve => setTimeout(() => {
            setLoadingMessage('Loading plant encyclopedia...');
            resolve(null);
          }, 800))
        );

        await Promise.all(criticalPromises);

      } catch (error) {
        console.error('[App] Critical initialization error:', error);
      } finally {
        if (isMounted) {
          clearInterval(messageInterval);
          setIsLoading(false);
        }
      }
    };

    initApp();
    
    return () => {
      isMounted = false;
      clearInterval(messageInterval);
    };
  }, []);

  // Add global error handlers
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('[Global] Error:', event.error);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[Global] Unhandled Rejection:', event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return (
    <React.StrictMode>
      {isLoading && <GlobalLoader message={loadingMessage} />}
      <ToastContainer position="bottom-right" theme="colored" />
      <App />
    </React.StrictMode>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);
