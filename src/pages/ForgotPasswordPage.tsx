import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, ChevronLeft } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

interface ForgotPasswordPageProps {
  onNavigate?: (page: string) => void;
  onBack?: () => void;
}

const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({ onNavigate, onBack }) => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
      toast({
        title: "Reset email sent",
        description: "Check your inbox for instructions to reset your password.",
        variant: "default",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#17A34A] text-white">
      {/* Header Section with Back Button */}
      <div className="relative w-full pt-4">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 z-20 bg-white/30 hover:bg-white/50 rounded-full text-green-900"
          aria-label="Go back"
          onClick={() => onBack ? onBack() : onNavigate && onNavigate("login")}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
      </div>

      {/* Form Section */}
      <div className="flex-grow flex flex-col items-center justify-center px-8 pb-8 pt-16">
        {/* Text Content */}
        <div className="text-center mb-8 w-full max-w-sm">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">
            Forgot Password
          </h1>
          <p className="text-sm sm:text-base text-green-200">
            {sent ? "Check your email for reset instructions" : "Enter your email to receive a reset link"}
          </p>
        </div>

        {sent ? (
          <div className="text-center">
            <p className="text-green-200 mb-8">
              We've sent you an email with instructions to reset your password.
              Please check your inbox and follow the link to create a new password.
            </p>
            <Button
              size="lg"
              className="w-full max-w-sm bg-green-900 hover:bg-green-950 text-white font-semibold rounded-full shadow-md py-3 text-lg mb-4"
              onClick={() => onNavigate && onNavigate("login")}
            >
              Back to Login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="w-full max-w-sm space-y-5">
            {/* Email */}
            <div className="flex items-center bg-white/90 rounded-lg p-3 shadow-sm">
              <Mail className="h-5 w-5 text-green-700 mr-3 flex-shrink-0" />
              <Input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-none focus:ring-2 focus:ring-green-600 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-0 text-green-900 placeholder-green-700/70 text-base"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full bg-green-900 hover:bg-green-950 text-white font-semibold rounded-full shadow-md py-3 text-lg mb-4 mt-4"
            >
              {loading ? "Sending..." : "Reset Password"}
            </Button>
          </form>
        )}

        {/* Back to Login Link */}
        <p className="text-sm text-green-200 mt-6">
          Remember your password?{' '}
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

export default ForgotPasswordPage; 