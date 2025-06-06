import React from 'react';
import { Button } from "@/components/ui/button";

// The URL should be replaced with your actual illustration
const illustrationUrl = '/green-plants-illustration.png'; 

interface AuthLandingPageProps {
  onNavigate?: (page: string) => void;
}

const AuthLandingPage: React.FC<AuthLandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-gradient-to-b from-[#17A34A] via-[#2E7D32] to-[#1B5E20] text-white p-8 pt-16">
      {/* Illustration Section */}
      <div className="flex-shrink-0 mb-8">
        <img
          src={illustrationUrl}
          alt="Greenur plants illustration"
          className="w-64 sm:w-80 h-auto object-contain drop-shadow-lg"
        />
      </div>

      {/* Text Content Section */}
      <div className="text-center mb-12 flex-grow flex flex-col justify-center">
        <h1 className="text-5xl sm:text-6xl font-bold mb-3 tracking-tight">
          Greenur
        </h1>
        <p className="text-base sm:text-lg text-emerald-100 max-w-xs mx-auto">
          Growing together for a greenur world
        </p>
      </div>

      {/* Button Section */}
      <div className="w-full max-w-xs flex flex-col gap-4">
        <Button
          size="lg"
          className="w-full bg-emerald-900/80 hover:bg-emerald-950/90 text-white font-semibold rounded-full shadow-md py-6 text-lg"
          onClick={() => onNavigate && onNavigate("login")}
        >
          Login
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full border-emerald-300/50 hover:bg-emerald-500/20 text-emerald-500 font-semibold rounded-full py-6 text-lg"
          onClick={() => onNavigate && onNavigate("signup")}
        >
          Sign Up
        </Button>
      </div>

      {/* Optional: Add some padding at the very bottom */}
      <div className="h-8 flex-shrink-0"></div>
    </div>
  );
};

export default AuthLandingPage; 