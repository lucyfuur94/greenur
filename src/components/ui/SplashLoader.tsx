import React, { useEffect } from 'react';

interface SplashLoaderProps {
  onFinished?: () => void;
  minDisplayTime?: number;
}

const SplashLoader: React.FC<SplashLoaderProps> = ({ 
  onFinished, 
  minDisplayTime = 2000 
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinished?.();
    }, minDisplayTime);

    return () => clearTimeout(timer);
  }, [onFinished, minDisplayTime]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-green-500 to-green-700 z-50">
      <div className="flex flex-col items-center justify-center">
        <div className="relative w-24 h-24 mb-8">
          {/* Animated leaf shape */}
          <div className="absolute w-20 h-20 bg-white/20 rounded-tl-full rounded-tr-full rounded-bl-full rotate-45 animate-pulse"></div>
          <div className="absolute w-16 h-16 bg-white/30 rounded-tl-full rounded-tr-full rounded-br-full -rotate-45 left-4 animate-pulse" style={{ animationDelay: '0.5s' }}></div>
        </div>
        
        <h1 className="text-4xl font-bold text-white mb-4">Greenur</h1>
        
        <div className="w-16 h-16 relative">
          <div className="absolute inset-0 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
        </div>
        
        <p className="text-white/80 mt-8 text-sm">Growing a greener future</p>
      </div>
    </div>
  );
};

export default SplashLoader; 