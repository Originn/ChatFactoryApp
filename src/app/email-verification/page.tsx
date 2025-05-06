'use client';

import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useState } from 'react';
import { auth } from '@/lib/firebase/config';
import { sendEmailVerification } from 'firebase/auth';

export default function EmailVerificationPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const [resendSuccess, setResendSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleResendVerification = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Check if user is currently signed in
      const currentUser = auth.currentUser;
      if (currentUser) {
        await sendEmailVerification(currentUser);
        setResendSuccess(true);
      } else {
        setError('You must be signed in to resend the verification email.');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to resend verification email');
      console.error('Resend verification error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold">DocsAI</Link>
          <nav>
            <Link href="/">
              <Button variant="ghost" className="text-white hover:bg-gray-800">Home</Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="text-white hover:bg-gray-800">Login</Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md shadow-lg border-blue-100">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-gray-900">Verify Your Email</CardTitle>
            <CardDescription>
              We've sent a verification link to {email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 text-blue-800 p-4 rounded-md text-sm">
              <p className="font-medium">Please check your email</p>
              <p className="mt-1">
                Click the verification link in the email we just sent you to verify your account.
                You will need to verify your email before accessing your account.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-800 p-4 rounded-md text-sm">
                {error}
              </div>
            )}

            {resendSuccess && (
              <div className="bg-green-50 text-green-800 p-4 rounded-md text-sm">
                Verification email resent successfully!
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <Button 
              onClick={handleResendVerification} 
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={isLoading || resendSuccess}
            >
              {isLoading ? 'Sending...' : resendSuccess ? 'Email Sent' : 'Resend Verification Email'}
            </Button>
            <Link href="/login" className="w-full">
              <Button variant="outline" className="w-full">
                Back to Login
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
