'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { useAuth } from '@/contexts/AuthContext';

// Password strength checker
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

export default function SignupPage() {
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signUpWithEmail } = useAuth();
  const router = useRouter();

  const passwordStrength = checkPasswordStrength(formData.password);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.displayName.trim()) {
      setError('Full name is required');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (passwordStrength.score < 3) {
      setError('Password is too weak. Please include: ' + passwordStrength.feedback.join(', '));
      return false;
    }
    if (!formData.agreeToTerms) {
      setError('You must agree to the Terms of Service');
      return false;
    }
    return true;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setError('');
    setIsLoading(true);

    try {
      await signUpWithEmail({
        email: formData.email,
        password: formData.password,
        displayName: formData.displayName,
        agreeToTerms: formData.agreeToTerms
      });
      
      router.push('/email-verification?email=' + encodeURIComponent(formData.email));
    } catch (error: any) {
      console.error('Signup error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists');
      } else if (error.code === 'auth/weak-password') {
        setError('Password is too weak');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else {
        setError(error.message || 'Failed to create account');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <Link href="/" className="flex items-center space-x-2 text-xl font-bold">
            <img src="/logo.png" alt="WizeChat" className="h-10 w-10" />
            <span>WizeChat</span>
          </Link>
          <nav>
            <Link href="/login">
              <Button variant="ghost" className="text-white hover:bg-gray-800">Login</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Signup Form */}
      <div className="flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md shadow-lg border-blue-100">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-gray-900">Create your account</CardTitle>
            <CardDescription>
              Enter your details to get started with WizeChat
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded mb-4">
                {error}
              </div>
            )}
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="displayName" className="text-sm font-medium">Full Name *</label>
                <Input 
                  id="displayName" 
                  type="text" 
                  placeholder="Enter your full name" 
                  value={formData.displayName}
                  onChange={(e) => handleChange('displayName', e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Email *</label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">Password *</label>
                <Input 
                  id="password" 
                  type="password"
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  required
                />
                {formData.password && (
                  <div className="text-xs space-y-1">
                    <div className={`font-medium ${passwordStrength.color}`}>
                      Strength: {passwordStrength.strength}
                    </div>
                    {passwordStrength.feedback.length > 0 && (
                      <div className="text-gray-600">
                        Missing: {passwordStrength.feedback.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password *</label>
                <Input 
                  id="confirmPassword" 
                  type="password"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  required
                />
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <div className="text-xs text-red-600">
                    Passwords do not match
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="terms"
                  checked={formData.agreeToTerms}
                  onCheckedChange={(checked) => handleChange('agreeToTerms', checked as boolean)}
                />
                <label htmlFor="terms" className="text-sm text-gray-600">
                  I agree to the{" "}
                  <Link href="/terms" className="text-blue-600 hover:text-blue-800">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-blue-600 hover:text-blue-800">
                    Privacy Policy
                  </Link>
                </label>
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isLoading || !formData.agreeToTerms}
              >
                {isLoading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex justify-center">
            <div className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 hover:text-blue-800 font-medium">
                Sign in
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
