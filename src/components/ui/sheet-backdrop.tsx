import React from 'react';
import { Button } from './button';
import { X } from 'lucide-react';

interface SheetBackdropProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export const SheetBackdrop: React.FC<SheetBackdropProps> = ({ 
  isOpen, 
  onClose, 
  children, 
  title = 'Details', 
  className = '' 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Back layer - visible at top, clickable to close */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-20"
        onClick={onClose}
      />
      
      {/* Front layer - doesn't cover full screen */}
      <div className="absolute top-16 left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-2xl">
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-white rounded-t-2xl">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose} className="p-2">
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Content */}
          <div className={`flex-1 overflow-auto p-4 bg-gray-50 ${className}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}; 