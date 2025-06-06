import { useState } from 'react';

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
  duration?: number;
  id?: string;
}

export type Toast = ToastOptions & { id: string };

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = (options: ToastOptions) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = {
      ...options,
      id,
      duration: options.duration || 5000,
    };
    
    setToasts((prev) => [...prev, newToast]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, newToast.duration);
    
    return id;
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return { toast, toasts, dismissToast };
}

export default useToast; 