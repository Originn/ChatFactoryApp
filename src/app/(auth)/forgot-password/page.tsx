'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useAuth } from '@/contexts/AuthContext';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    try {
      await resetPassword(email);
      setMessage('Check your email for password reset instructions.');
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        setError('No account found with this email address');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email address');
      } else {
        setError(error.message || 'Failed to send reset email');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold">Chat Factory</Link>
          <nav>
            <Link href="/login">
              <Button variant="ghost" className="text-white hover:bg-gray-800">Login</Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md shadow-lg border-blue-100">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-gray-900">Reset Password</CardTitle>
            <CardDescription>
              Enter your email address and we'll send you a link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded mb-4">
                {error}
              </div>
            )}
            {message && (
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-2 rounded mb-4">
                {message}
              </div>
            )}
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <Link href="/login" className="text-sm text-blue-600 hover:text-blue-800">
                Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
