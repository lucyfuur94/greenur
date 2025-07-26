import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Lock, ChevronLeft } from 'lucide-react';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

interface LoginPageProps {
  onNavigate?: (page: string) => void;
  onBack?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onNavigate, onBack }) => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Missing information",
        description: "Please enter both email and password.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
        variant: "default",
      });
      onNavigate && onNavigate("home");
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        toast({
          title: "User not found",
          description: "This email is not registered. Please sign up first.",
          variant: "destructive",
        });
      } else if (error.code === 'auth/wrong-password') {
        toast({
          title: "Incorrect password",
          description: "The password you entered is incorrect.",
          variant: "destructive",
        });
      } else if (error.code === 'auth/invalid-credential') {
        toast({
          title: "Invalid credentials",
          description: "The email or password you entered is incorrect.",
          variant: "destructive",
        });
      } else if (error.code === 'auth/too-many-requests') {
        toast({
          title: "Too many attempts",
          description: "Account temporarily locked due to too many failed login attempts. Try again later or reset your password.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Please check your credentials and try again",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      toast({
        title: "Welcome to Greenur!",
        description: "You've successfully signed in with Google.",
        variant: "default",
      });
      onNavigate && onNavigate("home");
    } catch (error) {
      toast({
        title: "Error signing in",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-primary text-primary-foreground">
      {/* Header Section with Back Button */}
      <div className="relative w-full pt-4">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 z-20 bg-white/30 hover:bg-white/50 rounded-full text-primary"
          aria-label="Go back"
          onClick={() => onBack ? onBack() : onNavigate && onNavigate("auth")}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* Form Section */}
      <div className="flex-grow flex flex-col items-center justify-center px-8 pb-8 pt-16">
        {/* Text Content */}
        <div className="text-center mb-8 w-full max-w-sm">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Welcome Back
          </h1>
          <p className="text-sm sm:text-base text-primary-foreground/80">
            Login to your account
          </p>
        </div>

        {/* Input Fields - Improved background and focus states */}
        <form onSubmit={handleEmailAuth} className="w-full max-w-sm space-y-5">
          {/* Email */}
          <div className="flex items-center bg-background/90 rounded-lg p-3 shadow-md">
            <User className="h-5 w-5 text-primary mr-3 flex-shrink-0" />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-2 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 text-foreground placeholder-muted-foreground text-base"
              required
            />
          </div>

          {/* Password */}
          <div className="flex items-center bg-background/90 rounded-lg p-3 shadow-md">
            <Lock className="h-5 w-5 text-primary mr-3 flex-shrink-0" />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-2 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 text-foreground placeholder-muted-foreground text-base"
              required
            />
          </div>

          {/* Forgot Password */}
          <div className="w-full flex justify-end items-center my-4">
            <Button 
              variant="link" 
              className="text-sm text-primary-foreground/70 hover:text-primary-foreground h-auto p-0 bg-transparent"
              onClick={() => onNavigate && onNavigate("forgot-password")}
            >
              Forgot Password?
            </Button>
          </div>

          {/* Login Button */}
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full bg-primary-foreground/90 hover:bg-primary-foreground text-primary font-semibold rounded-full shadow-md py-3 text-base mb-4"
          >
            {loading ? "Signing in..." : "Login"}
          </Button>
        </form>

        {/* OR Divider */}
        <div className="relative w-full max-w-sm my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-primary-foreground/30" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-primary px-2 text-primary-foreground/80">
              Or continue with
            </span>
          </div>
        </div>

        {/* Google Button - Improved visibility */}
        <Button
          onClick={handleGoogleSignIn}
          disabled={loading}
          variant="outline"
          size="lg"
                      className="w-full max-w-sm bg-background border-primary/50 hover:bg-primary/10 text-foreground font-semibold rounded-full mb-6 text-base"
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google
        </Button>

        {/* Sign Up Link - Changed to camel case */}
        <p className="text-sm text-primary-foreground/80">
          Don't have an account?{' '}
          <Button 
            variant="link" 
            className="text-primary-foreground font-semibold h-auto p-0 inline underline bg-transparent"
            onClick={() => onNavigate && onNavigate("signup")}
          >
            Sign up
          </Button>
        </p>
      </div>
    </div>
  );
};

export default LoginPage; 