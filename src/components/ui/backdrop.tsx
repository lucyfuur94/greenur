import React from 'react';
import { motion, AnimatePresence, MotionProps } from 'framer-motion';
import { MouseEvent } from 'react';

interface BackdropProps {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const Backdrop: React.FC<BackdropProps> = ({ 
  isOpen, 
  onClose, 
  children, 
  className = '' 
}) => {
  const handleBackdropClick = (e: MouseEvent) => {
    onClose?.();
  };

  const handleContentClick = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm ${className}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleBackdropClick}
        >
          <motion.div 
            className="relative max-w-[90%] max-h-[90%] w-full"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={handleContentClick}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}; 