import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Mail, Lock, ChevronLeft } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

interface SignupPageProps {
  onNavigate?: (page: string) => void;
  onBack?: () => void;
}

const SignupPage: React.FC<SignupPageProps> = ({ onNavigate, onBack }) => {
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please ensure both passwords match.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      toast({
        title: "Welcome to Greenur!",
        description: "Your account has been created successfully.",
        variant: "default",
      });
      onNavigate && onNavigate("home");
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        toast({
          title: "Email already registered",
          description: "This email is already registered. Please login instead.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error creating account",
          description: error.message || "Please try again",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-primary text-primary-foreground relative overflow-hidden">
      {/* Back Button */}
      <div className="absolute top-4 left-4 z-20">
        <Button
          variant="ghost"
          size="icon"
          className="bg-white/30 hover:bg-white/50 rounded-full text-primary"
          aria-label="Go back"
          onClick={() => onBack ? onBack() : onNavigate && onNavigate("auth")}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* Form Section - Scrollable content area */}
      <div className="flex-grow flex flex-col items-center justify-center px-6 sm:px-8 pt-20 pb-8 z-10">
        {/* Text Content */}
        <div className="text-center mb-8 w-full max-w-sm">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Register
          </h1>
          <p className="text-sm sm:text-base text-green-200">
            Create your account
          </p>
        </div>

        {/* Input Fields */}
        <form onSubmit={handleSignup} className="w-full max-w-sm space-y-4">
          {/* Username Input */}
          <div className="flex items-center bg-background/90 rounded-lg p-3 shadow-sm">
            <User className="h-5 w-5 text-primary mr-3 flex-shrink-0" />
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-2 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 text-foreground placeholder-muted-foreground text-base"
              autoComplete="username"
            />
          </div>

          {/* Email Input */}
          <div className="flex items-center bg-background/90 rounded-lg p-3 shadow-sm">
            <Mail className="h-5 w-5 text-primary mr-3 flex-shrink-0" />
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-2 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 text-foreground placeholder-muted-foreground text-base"
              autoComplete="email"
              required
            />
          </div>

          {/* Password Input */}
          <div className="flex items-center bg-background/90 rounded-lg p-3 shadow-sm">
            <Lock className="h-5 w-5 text-primary mr-3 flex-shrink-0" />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-2 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 text-foreground placeholder-muted-foreground text-base"
              autoComplete="new-password"
              required
            />
          </div>

          {/* Confirm Password Input */}
          <div className="flex items-center bg-background/90 rounded-lg p-3 shadow-sm">
            <Lock className="h-5 w-5 text-primary mr-3 flex-shrink-0" />
            <Input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-transparent border-none focus:ring-2 focus:ring-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 text-foreground placeholder-muted-foreground text-base"
              autoComplete="new-password"
              required
            />
          </div>

          {/* Terms Text */}
          <p className="text-xs text-green-200 text-center mt-6 mb-6 mx-auto w-full max-w-xs">
            By registering, you are agreeing to our Terms of use and Privacy Policy.
          </p>

          {/* Register Button */}
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full bg-green-900 hover:bg-green-950 text-white font-semibold rounded-full shadow-md py-3 text-lg mb-6"
          >
            {loading ? "Creating account..." : "Register"}
          </Button>
        </form>

        {/* Login Link */}
        <p className="text-sm text-green-200">
          Already have an account?{' '}
          <Button 
            variant="link" 
            className="text-white font-semibold h-auto p-0 inline underline bg-transparent"
            onClick={() => onNavigate && onNavigate("login")}
          >
            Login
          </Button>
        </p>
      </div>
    </div>
  );
};

export default SignupPage; 