// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Correct path based on file found

export interface AuthState {
  user: FirebaseUser | null;
  token: string | null;
  isLoading: boolean;
  error: Error | null;
}

export const useAuth = (): AuthState => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken();
          setAuthState({ user: firebaseUser, token: idToken, isLoading: false, error: null });
        } catch (e) {
          console.error("Error getting ID token in useAuth:", e);
          setAuthState({ user: firebaseUser, token: null, isLoading: false, error: e as Error });
        }
      } else {
        setAuthState({ user: null, token: null, isLoading: false, error: null });
      }
    }, (err) => {
        console.error("Auth state error in useAuth:", err);
        setAuthState({ user: null, token: null, isLoading: false, error: err });
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  return authState;
}; 