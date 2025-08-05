'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { useAuth } from '@/contexts/AuthContext';
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react';
import MarketingHeader from '@/components/shared/MarketingHeader';

// Password strength checker for signup mode
const checkPasswordStrength = (password: string) => {
  let score = 0;
  const feedback = [];

  if (password.length >= 8) score++;
  else feedback.push('At least 8 characters');

  if (/[a-z]/.test(password)) score++;
  else feedback.push('Lowercase letter');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('Uppercase letter');

  if (/[0-9]/.test(password)) score++;
  else feedback.push('Number');

  if (/[^a-zA-Z0-9]/.test(password)) score++;
  else feedback.push('Special character');

  const strength = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'][score];
  const color = ['text-red-600', 'text-orange-600', 'text-yellow-600', 'text-blue-600', 'text-green-600'][score];

  return { strength, color, score, feedback };
};

export default function LoginPage() {
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signInWithEmail, signInWithGoogle, signUpWithEmail } = useAuth();
  const router = useRouter();

  const passwordStrength = checkPasswordStrength(password);

  const validateSignupForm = () => {
    if (!displayName.trim()) {
      setError('Full name is required');
      return false;
    }
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (passwordStrength.score < 3) {
      setError('Password is too weak. Please include: ' + passwordStrength.feedback.join(', '));
      return false;
    }
    if (!agreeToTerms) {
      setError('You must agree to the Terms of Service');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isSignupMode) {
        if (!validateSignupForm()) return;
        
        await signUpWithEmail({
          email,
          password,
          displayName,
          agreeToTerms
        });
        
        router.push('/email-verification?email=' + encodeURIComponent(email));
      } else {
        await signInWithEmail({ email, password });
        router.push('/dashboard');
      }
    } catch (error: any) {
      console.error(isSignupMode ? 'Signup error:' : 'Login error:', error);
      
      if (isSignupMode) {
        if (error.code === 'auth/email-already-in-use') {
          setError('An account with this email already exists');
        } else if (error.code === 'auth/weak-password') {
          setError('Password is too weak');
        } else if (error.code === 'auth/invalid-email') {
          setError('Invalid email address');
        } else {
          setError(error.message || 'Failed to create account');
        }
      } else {
        setError(error.message || 'Failed to sign in');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);

    try {
      await signInWithGoogle();
      // Explicitly redirect to dashboard after successful Google auth
      router.push('/dashboard');
    } catch (error: any) {
      setError(error.message || 'Failed to sign in with Google');
      console.error('Google login error:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <MarketingHeader showHomeButton={true} showAuthButtons={true} currentPage="login" />

      {/* Auth Form */}
      <div className="flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-bold text-foreground">
                  {isSignupMode ? 'Create your account' : 'Log in to WizeChat'}
                </CardTitle>
                <CardDescription>
                  {isSignupMode 
                    ? 'Enter your details to get started with WizeChat'
                    : 'Enter your email and password to access your account'
                  }
                </CardDescription>
              </div>
            </div>
            
            {/* Toggle between Login/Signup */}
            <div className="flex items-center justify-center space-x-1 mt-4">
              <Button
                variant={!isSignupMode ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setIsSignupMode(false);
                  setError('');
                  setConfirmPassword('');
                  setDisplayName('');
                  setAgreeToTerms(false);
                }}
                className="flex-1"
              >
                <LogIn className="h-4 w-4 mr-2" />
                Login
              </Button>
              <Button
                variant={isSignupMode ? "default" : "ghost"}
                size="sm"
                onClick={() => {
                  setIsSignupMode(true);
                  setError('');
                }}
                className="flex-1"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Sign Up
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-4 py-2 rounded mb-4">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name - only show in signup mode */}
              {isSignupMode && (
                <div className="space-y-2">
                  <label htmlFor="displayName" className="text-sm font-medium text-foreground">Full Name *</label>
                  <Input 
                    id="displayName" 
                    type="text" 
                    placeholder="Enter your full name" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  Email {isSignupMode && '*'}
                </label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium text-foreground flex items-center">
                    <Lock className="h-4 w-4 mr-2" />
                    Password {isSignupMode && '*'}
                  </label>
                  {!isSignupMode && (
                    <Link href="/forgot-password" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                      Forgot password?
                    </Link>
                  )}
                </div>
                <Input 
                  id="password" 
                  type="password"
                  placeholder={isSignupMode ? "Create a strong password" : "Enter your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {/* Password strength indicator - only show in signup mode */}
                {isSignupMode && password && (
                  <div className="text-xs space-y-1">
                    <div className={`font-medium ${passwordStrength.color}`}>
                      Strength: {passwordStrength.strength}
                    </div>
                    {passwordStrength.feedback.length > 0 && (
                      <div className="text-muted-foreground">
                        Missing: {passwordStrength.feedback.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Password - only show in signup mode */}
              {isSignupMode && (
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirm Password *</label>
                  <Input 
                    id="confirmPassword" 
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <div className="text-xs text-red-600 dark:text-red-300">
                      Passwords do not match
                    </div>
                  )}
                </div>
              )}

              {/* Terms agreement - only show in signup mode */}
              {isSignupMode && (
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="terms"
                    checked={agreeToTerms}
                    onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
                  />
                  <label htmlFor="terms" className="text-sm text-muted-foreground">
                    I agree to the{" "}
                    <Link href="/terms" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                      Privacy Policy
                    </Link>
                  </label>
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isLoading || (isSignupMode && !agreeToTerms)}
              >
                {isSignupMode ? (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    {isLoading ? 'Creating account...' : 'Create Account'}
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </>
                )}
              </Button>
            </form>
            
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-card text-muted-foreground">Or continue with</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleGoogleLogin}
                disabled={isLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </Button>
            </div>
          </CardContent>
          {!isSignupMode && (
            <CardFooter className="flex justify-center">
              <div className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <button 
                  onClick={() => setIsSignupMode(true)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                >
                  Sign up
                </button>
              </div>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
