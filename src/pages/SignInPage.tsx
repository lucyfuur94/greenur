import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useToast } from '@/lib/useToast';

export const SignInPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        toast({
          title: "Account created",
          description: "Your account has been created successfully!",
          variant: "default",
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast({
          title: "Welcome back",
          description: "You've successfully signed in.",
          variant: "default",
        });
      }
      
      navigate('/home');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An error occurred during authentication.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F7F5] p-4">
      <Card className="w-full max-w-md p-6 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-green-700 mb-2">
            {isSignUp ? "Create an Account" : "Welcome to Botanica"}
          </h1>
          <p className="text-gray-600">
            {isSignUp 
              ? "Join our community of plant lovers" 
              : "Sign in to access your plant care assistant"}
          </p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
            <Input 
              id="email" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="Enter your email"
              className="mt-1"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
            <Input 
              id="password" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Enter your password"
              className="mt-1"
              required
            />
          </div>

          <Button 
            type="submit" 
            className="w-full bg-green-600 hover:bg-green-700 text-white !rounded-button"
            disabled={loading}
          >
            {loading 
              ? "Processing..." 
              : isSignUp 
                ? "Create Account" 
                : "Sign In"}
          </Button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {isSignUp 
              ? "Already have an account?" 
              : "Don't have an account?"}
            <Button 
              variant="link" 
              className="p-0 h-auto text-green-600 font-medium"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? " Sign in" : " Create one"}
            </Button>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default SignInPage; 