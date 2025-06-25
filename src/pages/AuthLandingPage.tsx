import React from 'react';
import { Button } from "@/components/ui/button";

// The URL should be replaced with your actual illustration
const illustrationUrl = '/green-plants-illustration.png'; 

interface AuthLandingPageProps {
  onNavigate?: (page: string) => void;
}

const AuthLandingPage: React.FC<AuthLandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-gradient-to-b from-primary via-primary/90 to-primary/80 dark:from-primary/90 dark:via-primary/70 dark:to-primary/60 text-primary-foreground p-8 pt-16">
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
        <p className="text-base sm:text-lg text-primary-foreground/80 max-w-xs mx-auto">
          Growing together for a greenur world
        </p>
      </div>

      {/* Button Section */}
      <div className="w-full max-w-xs flex flex-col gap-4">
        <Button
          size="lg"
          className="w-full bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground font-semibold rounded-full shadow-md py-6 text-lg border border-primary-foreground/30"
          onClick={() => onNavigate && onNavigate("login")}
        >
          Login
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full border-primary-foreground/30 hover:bg-primary-foreground/10 text-primary-foreground font-semibold rounded-full py-6 text-lg"
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