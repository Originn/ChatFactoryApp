'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { sendEmailVerification } from 'firebase/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Check for dev mode verification bypass
    const devEmailVerified = process.env.NODE_ENV === 'development' && 
      (localStorage.getItem('devEmailVerified') === 'true' || 
       (user && localStorage.getItem(`user_${user.uid}_verified`) === 'true'));
    
    // Don't redirect if we're still loading authentication state
    if (loading) return;
    
    // Don't redirect if we're already on a public page
    if (pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/') || pathname === '/email-verification') {
      return;
    }
    
    // Check if we might be in the middle of an OAuth redirect
    // Look for common OAuth callback indicators in the URL
    const isOAuthCallback = typeof window !== 'undefined' && (
      window.location.search.includes('code=') ||
      window.location.search.includes('state=') ||
      window.location.hash.includes('access_token=') ||
      document.referrer.includes('accounts.google.com')
    );
    
    // If we're potentially in an OAuth callback, give it more time to complete
    if (isOAuthCallback && !user) {
      const timeoutId = setTimeout(() => {
        // Only redirect if user is still null after OAuth processing time
        if (!user && !loading) {
          router.push('/login');
        }
      }, 2000); // Wait 2 seconds for OAuth to complete
      
      return () => clearTimeout(timeoutId);
    }
    
    // Standard redirect for unauthenticated users
    if (!user) {
      router.push('/login');
    }
  }, [user, loading, router, pathname]);

  const handleResendVerification = async () => {
    if (!user) return;
    
    setResendLoading(true);
    setError('');
    
    try {
      await sendEmailVerification(user);
      setResendSuccess(true);
    } catch (error: any) {
      setError(error.message || 'Failed to resend verification email');
      console.error('Resend verification error:', error);
    } finally {
      setResendLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Check for dev mode verification bypass
  const devEmailVerified = process.env.NODE_ENV === 'development' && 
    (typeof window !== 'undefined' && 
     (localStorage.getItem('devEmailVerified') === 'true' || 
      (user && localStorage.getItem(`user_${user.uid}_verified`) === 'true')));

  // Require email verification
  if (user && !user.emailVerified && !devEmailVerified && pathname !== '/email-verification') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Email Verification Required</CardTitle>
            <CardDescription>
              Please verify your email address to continue
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 text-yellow-800 p-4 rounded-md text-sm">
              <p className="font-medium">Verification required</p>
              <p className="mt-1">
                We've sent a verification link to {user.email}. Please check your inbox and click the link to verify your account.
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
              className="w-full"
              disabled={resendLoading || resendSuccess}
            >
              {resendLoading ? 'Sending...' : resendSuccess ? 'Email Sent' : 'Resend Verification Email'}
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => router.push('/login')}
            >
              Back to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
