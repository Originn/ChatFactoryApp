'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  verifyPasswordResetCode, 
  confirmPasswordReset,
  applyActionCode,
  checkActionCode,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AuthActionHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionType, setActionType] = useState<'resetPassword' | 'verifyEmail' | 'unknown'>('unknown');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [devBypass, setDevBypass] = useState(false);

  // Get oobCode (out-of-band code) from URL
  const oobCode = searchParams.get('oobCode') || '';
  const mode = searchParams.get('mode') || '';
  const apiKey = searchParams.get('apiKey') || '';
  const continueUrl = searchParams.get('continueUrl') || '';

  // Single execution flag to prevent duplicate calls
  const [actionPerformed, setActionPerformed] = useState(false);

  // Handle development environment verification bypass
  const handleDevBypass = () => {
    // In development, we'll simulate a successful verification
    if (process.env.NODE_ENV === 'development') {
      setDevBypass(true);
      setSuccess('Development mode: Email verification simulated successfully!');
      setActionType('verifyEmail');
      setIsLoading(false);
      
      // Store mock user verification in localStorage
      localStorage.setItem('devEmailVerified', 'true');
      
      // If there's a current user, we'll update the local cache for them
      if (auth.currentUser) {
        localStorage.setItem(`user_${auth.currentUser.uid}_verified`, 'true');
      }
    }
  };

  useEffect(() => {
    // Prevent double execution
    if (actionPerformed) return;
    
    const handleAction = async () => {
      if (!oobCode) {
        console.error('No oobCode found in URL');
        setError('Invalid action code. Please try again.');
        setIsLoading(false);
        return;
      }

      // Store debugging info
      const debug = {
        mode,
        apiKeyPartial: apiKey ? `${apiKey.slice(0, 5)}...` : 'none',
        envApiKeyPartial: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 
          `${process.env.NEXT_PUBLIC_FIREBASE_API_KEY.slice(0, 5)}...` : 'none',
        actionUrl: window.location.href.split('?')[0],
        continueUrl: continueUrl,
        isDevelopment: process.env.NODE_ENV === 'development'
      };
      setDebugInfo(debug);
      console.log('Debug info:', debug);
      
      // Mark that we've performed the action to prevent duplicate processing
      setActionPerformed(true);

      try {        
        // Check if we should bypass verification in development
        if (process.env.NODE_ENV === 'development' && mode === 'verifyEmail') {
          handleDevBypass();
          return;
        }
        
        // Try to sign out first to clear any existing session
        try {
          await signOut(auth);
          console.log('Signed out existing user for clean verification state');
        } catch (signOutError) {
          console.log('No user to sign out or error signing out:', signOutError);
        }

        if (mode === 'resetPassword') {
          console.log('Processing password reset');
          // Verify the password reset code
          const email = await verifyPasswordResetCode(auth, oobCode);
          console.log('Password reset code verified for:', email);
          setEmail(email);
          setActionType('resetPassword');
          
        } else if (mode === 'verifyEmail') {
          console.log('Processing email verification');
          
          try {
            // Handle email verification directly without trying checkActionCode first
            await applyActionCode(auth, oobCode);
            console.log('Email verification successful');
            
            setSuccess('Your email has been verified successfully!');
            setActionType('verifyEmail');
          } catch (verifyError) {
            console.error('Initial verification failed:', verifyError);
            
            // If we're in development, allow bypass even if verification fails
            if (process.env.NODE_ENV === 'development') {
              console.log('Using development bypass after verification failure');
              handleDevBypass();
              return;
            } else {
              throw verifyError; // Re-throw in production
            }
          }
        } else {
          console.error('Invalid mode:', mode);
          setError(`Invalid action type: ${mode || 'none'}. Please try again.`);
        }
      } catch (error: any) {
        console.error('Action handler error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // In development mode, allow verification bypass even on error
        if (process.env.NODE_ENV === 'development' && mode === 'verifyEmail') {
          console.log('Using development bypass after error');
          handleDevBypass();
          return;
        }
        
        // Provide more specific error messages
        if (error.code === 'auth/invalid-action-code') {
          setError('The verification link has expired or already been used. Please request a new verification email.');
        } else if (error.code === 'auth/user-not-found') {
          setError('The user associated with this email could not be found.');
        } else if (error.code === 'auth/argument-error') {
          setError('There was a problem with the verification link. Please request a new one.');
        } else if (error.code === 'auth/expired-action-code') {
          setError('This verification link has expired. Please request a new verification email.');
        } else {
          setError(`Error: ${error.message || 'An unknown error occurred'}`);
        }
      } finally {
        if (!devBypass) {
          setIsLoading(false);
        }
      }
    };

    handleAction();
  }, [oobCode, mode, apiKey, actionPerformed, continueUrl, devBypass]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password should be at least 6 characters');
      return;
    }

    setIsLoading(true);
    
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess('Password has been reset successfully!');
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to reset password');
      console.error('Password reset error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Display loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Display error
  if (error && !devBypass) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-red-600">Error</CardTitle>
            <CardDescription>There was a problem processing your request</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">{error}</p>
            
            {error.includes('expired') || error.includes('invalid') ? (
              <div className="mt-4 p-4 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-700 font-medium">What you can do now:</p>
                <ul className="list-disc pl-5 mt-2 text-sm text-blue-700">
                  <li>Go back to login and sign in with your credentials</li>
                  <li>After signing in, request a new verification email</li>
                  <li>Make sure to use the verification link within 1 hour</li>
                </ul>
              </div>
            ) : null}
            
            {process.env.NODE_ENV === 'development' && (
              <>
                <div className="mt-4 p-3 bg-gray-100 rounded text-xs font-mono overflow-auto">
                  <p className="font-bold mb-1">Debug Info:</p>
                  <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
                </div>
                
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded">
                  <p className="text-sm font-medium text-amber-800">Development Mode Options</p>
                  <p className="text-xs text-amber-700 mt-1 mb-3">
                    In development, you can bypass email verification to continue working on your app.
                  </p>
                  <Button 
                    onClick={handleDevBypass} 
                    variant="outline" 
                    className="w-full border-amber-300 text-amber-800 hover:bg-amber-100"
                  >
                    Bypass Verification (Dev Only)
                  </Button>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/login')} className="w-full">
              Go to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Display email verification success
  if ((actionType === 'verifyEmail' && success) || devBypass) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-green-600">Email Verified</CardTitle>
            <CardDescription>Your email has been successfully verified</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-green-50 p-4 rounded-md flex items-center space-x-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-green-700">{success || "Email verification successful!"}</p>
            </div>
            <p className="mt-4 text-sm text-gray-600">
              You can now enjoy full access to your DocsAI account. Return to login to continue to your dashboard.
            </p>
            
            {devBypass && (
              <div className="mt-4 p-3 bg-amber-50 rounded border border-amber-200">
                <p className="text-xs text-amber-800">
                  <strong>Development Mode:</strong> Verification has been simulated. This bypass works only in development.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/login')} className="w-full bg-green-600 hover:bg-green-700">
              Continue to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Display password reset form
  if (actionType === 'resetPassword') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Reset Your Password</CardTitle>
            <CardDescription>
              {success ? (
                <span className="text-green-600">{success}</span>
              ) : (
                `Enter a new password for ${email}`
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!success && (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">New Password</label>
                  <Input 
                    id="password" 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={!!success}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium">Confirm New Password</label>
                  <Input 
                    id="confirmPassword" 
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={!!success}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={!!success || isLoading}
                >
                  {isLoading ? 'Resetting Password...' : 'Reset Password'}
                </Button>
              </form>
            )}
          </CardContent>
          {success && (
            <CardFooter>
              <p className="text-sm text-gray-500 w-full text-center">
                Redirecting to login page...
              </p>
            </CardFooter>
          )}
        </Card>
      </div>
    );
  }

  // Fallback
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Unknown Action</CardTitle>
          <CardDescription>We couldn't determine what you're trying to do</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-700">
            The link you followed appears to be invalid or expired. Please try again or contact support.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-3 bg-gray-100 rounded text-xs font-mono overflow-auto">
              <p className="font-bold mb-1">Debug Info:</p>
              <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={() => router.push('/login')} className="w-full">
            Back to Login
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
