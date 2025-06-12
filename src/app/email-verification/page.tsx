'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useState, useEffect, Suspense } from 'react';
import { CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { ChatbotEmailVerificationService } from '@/services/chatbotEmailVerificationService';

function EmailVerificationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // UI State
  const [status, setStatus] = useState<'loading' | 'verified' | 'error' | 'expired' | 'password-setup'>('loading');
  const [message, setMessage] = useState('');
  const [chatbotName, setChatbotName] = useState('');
  
  // Password Setup State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  
  // URL Parameters - trying both possible parameter names
  const oobCode = searchParams.get('oobCode'); // Firebase action code
  const mode = searchParams.get('mode'); // Firebase action mode
  const customToken = searchParams.get('token'); // Custom token for direct password setup
  const chatbotId = searchParams.get('chatbot') || searchParams.get('chatbotId'); // Try both
  const continueUrl = searchParams.get('continueUrl') || searchParams.get('continue'); // Try both
  const email = searchParams.get('email'); // For general verification

  console.log('🔍 EmailVerificationContent loaded with params:', {
    oobCode: oobCode ? 'present' : 'missing',
    mode,
    customToken: customToken ? `present (${customToken.length} chars)` : 'missing',
    chatbotId,
    continueUrl: continueUrl ? 'present' : 'missing',
    email,
    url: typeof window !== 'undefined' ? window.location.href : 'server-side',
    allSearchParams: typeof window !== 'undefined' ? Object.fromEntries(searchParams.entries()) : 'server-side'
  });

  useEffect(() => {
    console.log('🔍 URL Parameters received:', {
      oobCode,
      mode, 
      customToken,
      chatbotId,
      continueUrl,
      email,
      allParams: Object.fromEntries(searchParams.entries())
    });
    
    initializeAndVerify();
  }, [oobCode, mode, customToken, chatbotId]);

  const initializeAndVerify = async () => {
    try {
      console.log('🔍 Email verification debug - Full URL:', window.location.href);
      console.log('🔍 All URL search params:', Object.fromEntries(searchParams.entries()));
      console.log('🔍 Specific token check:', {
        tokenParam: searchParams.get('token'),
        tokenLength: searchParams.get('token')?.length || 0
      });

      // Simple validation first - just check if we have what we need
      if (customToken && chatbotId) {
        console.log('✅ Have custom token and chatbot ID - proceeding to password setup');
        setStatus('password-setup');
        setMessage('Please choose your password to complete registration.');
        return;
      } else if (chatbotId && searchParams.get('token')) {
        console.log('✅ Have token via searchParams and chatbot ID - proceeding to password setup');
        setStatus('password-setup');  
        setMessage('Please choose your password to complete registration.');
        return;
      }

      console.log('❌ Missing required parameters:', {
        hasCustomToken: !!customToken,
        hasChatbotId: !!chatbotId,
        hasTokenViaSearchParams: !!searchParams.get('token')
      });

      setStatus('error');
      setMessage('Invalid verification link. Please check your email for the correct link.');
      
    } catch (error: any) {
      console.error('❌ Initialization error:', error);
      setStatus('error');
      setMessage('Failed to initialize verification process. Please try again.');
    }
  };

  const handleEmailVerification = async () => {
    try {
      if (!oobCode) {
        throw new Error('No setup code provided');
      }

      // For the new flow, we always expect resetPassword mode
      if (mode === 'resetPassword') {
        setStatus('password-setup');
        setMessage('Please choose your password to complete registration.');
      } else {
        // Legacy email verification flow (fallback)
        
        const result = await ChatbotEmailVerificationService.verifyEmail(oobCode);
        
        if (result.success) {
          if (result.needsPasswordSetup) {
            setStatus('password-setup');
            setMessage('Email verified! Please set your password to complete registration.');
          } else {
            setStatus('verified');
            setMessage('Email verified successfully! You can now access the chatbot.');
          }
        } else {
          if (result.error?.includes('expired')) {
            setStatus('expired');
            setMessage('This setup link has expired. Please request a new invitation.');
          } else {
            setStatus('error');
            setMessage(result.error || 'Email verification failed');
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Setup process error:', error);
      setStatus('error');
      setMessage('Setup process failed. Please try again.');
    }
  };

  const handlePasswordSetup = async () => {
    try {
      // Reset any previous errors
      setPasswordError('');
      
      // Validate passwords
      if (!password || !confirmPassword) {
        setPasswordError('Please fill in both password fields');
        return;
      }
      
      if (password !== confirmPassword) {
        setPasswordError('Passwords do not match');
        return;
      }
      
      if (password.length < 6) {
        setPasswordError('Password must be at least 6 characters long');
        return;
      }

      setIsSettingPassword(true);

      // Check which flow to use
      const actualToken = customToken || searchParams.get('token');
      
      if (actualToken) {
        // Use the new custom token flow (direct password setup)
        
        // For custom token flow, we validate via our API endpoint first
        try {
          const response = await fetch('/api/auth/validate-token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              token: actualToken,
              chatbotId: chatbotId
            })
          });

          const validation = await response.json();
          console.log('🔍 Token validation response:', validation);

          if (!response.ok) {
            console.error('❌ Token validation failed:', validation.error);
            setPasswordError(validation.error || 'Invalid setup link');
            setIsSettingPassword(false);
            return;
          }

          // Extract email from validation response
          const userEmail = validation.email;
          console.log('✅ Token validated, setting up password for:', userEmail);
          
          const result = await fetch('/api/auth/setup-password', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              token: actualToken,
              newPassword: password,
              email: userEmail
            })
          });

          const setupResult = await result.json();
          console.log('🔍 Password setup result:', setupResult);

          if (result.ok && setupResult.success) {
            console.log('✅ Password setup successful');
            setStatus('verified');
            setMessage('Your password has been set successfully!');
            
            // Mark token as used
            try {
              await fetch('/api/auth/mark-token-used', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token: actualToken })
              });
            } catch (markError) {
              console.warn('⚠️ Could not mark token as used:', markError);
            }
            
            // Redirect after a short delay
            setTimeout(() => {
              if (continueUrl) {
                window.location.href = continueUrl;
              } else {
                handleContinue();
              }
            }, 2000);
          } else {
            console.error('❌ Password setup failed:', setupResult.error);
            setPasswordError(setupResult.error || 'Failed to set password');
          }

        } catch (error) {
          console.error('❌ Custom token password setup failed:', error);
          setPasswordError('An error occurred while setting up your password. Please try again.');
        }
        
        setIsSettingPassword(false);
        return;
      }

      // Firebase oobCode flows (legacy and fallback)
      if (mode === 'resetPassword' && oobCode) {
        // Firebase password reset flow
        console.log('🔧 Using Firebase password reset flow');
        const result = await ChatbotEmailVerificationService.resetPassword(oobCode, password);
        
        if (result.success) {
          setStatus('verified');
          setMessage('Your password has been set successfully!');
          
          // Redirect after a short delay
          setTimeout(() => {
            if (continueUrl) {
              window.location.href = continueUrl;
            } else {
              handleContinue();
            }
          }, 2000);
        } else {
          setPasswordError(result.error || 'Failed to set password');
        }
        
        setIsSettingPassword(false);
        return;
      }

      // Legacy flow - extract email from continue URL or use current user
      let userEmail = '';
      if (continueUrl) {
        const urlParams = new URLSearchParams(continueUrl.split('?')[1] || '');
        userEmail = urlParams.get('email') || '';
      }
      
      if (!userEmail) {
        // Try to get email from the current user
        const currentUser = ChatbotEmailVerificationService.getCurrentUser();
        if (currentUser?.email) {
          userEmail = currentUser.email;
        } else {
          setPasswordError('Could not determine email address. Please contact support.');
          setIsSettingPassword(false);
          return;
        }
      }

      // Legacy password setup flow
      console.log('🔧 Using legacy password setup flow');
      const result = await ChatbotEmailVerificationService.setupPassword(userEmail, password);

      // Legacy password setup result handling
      if (result.success) {
        setStatus('verified');
        setMessage('Your password has been set successfully!');
        
        // Redirect after a short delay
        setTimeout(() => {
          if (continueUrl) {
            window.location.href = continueUrl;
          } else {
            handleContinue();
          }
        }, 2000);
      } else {
        setPasswordError(result.error || 'Failed to set password');
      }
      
    } catch (error: any) {
      console.error('❌ Password setup error:', error);
      setPasswordError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSettingPassword(false);
    }
  };

  const handleContinue = () => {
    if (continueUrl) {
      window.location.href = continueUrl;
    } else if (chatbotId) {
      // Redirect to the chatbot
      const chatbotUrl = window.location.origin;
      window.location.href = chatbotUrl;
    } else {
      router.push('/dashboard');
    }
  };

  const handleRequestNewInvitation = () => {
    // Redirect to a contact form or support page
    router.push('/contact');
  };

  // Legacy general verification UI
  if (email && !oobCode && !chatbotId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-gray-900 text-white py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <Link href="/" className="text-xl font-bold">ChatFactory</Link>
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
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Main verification content renderer
  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
            <h2 className="mt-4 text-xl font-semibold">Setting up your account...</h2>
            <p className="mt-2 text-gray-600">Please wait while we prepare your password setup.</p>
          </div>
        );

      case 'password-setup':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
              <h2 className="mt-4 text-xl font-semibold text-green-800">
                Ready to Set Your Password!
              </h2>
              <p className="mt-2 text-gray-600">{message}</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              {passwordError && (
                <div className="text-red-600 text-sm">{passwordError}</div>
              )}
              
              <Button 
                onClick={handlePasswordSetup} 
                className="w-full"
                disabled={isSettingPassword}
              >
                {isSettingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Your Account...
                  </>
                ) : (
                  'Complete Setup'
                )}
              </Button>
            </div>
          </div>
        );

      case 'verified':
        return (
          <div className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
            <h2 className="mt-4 text-xl font-semibold text-green-800">Account Setup Complete!</h2>
            <p className="mt-2 text-gray-600">Your password has been set successfully.</p>
            {chatbotName && (
              <p className="mt-2 text-sm text-gray-500">
                You now have access to <strong>{chatbotName}</strong>
              </p>
            )}
            <Button onClick={handleContinue} className="mt-6">
              Access Chatbot
            </Button>
          </div>
        );

      case 'expired':
        return (
          <div className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-orange-600" />
            <h2 className="mt-4 text-xl font-semibold text-orange-800">Link Expired</h2>
            <p className="mt-2 text-gray-600">{message}</p>
            <div className="mt-6 space-y-3">
              <Button onClick={handleRequestNewInvitation} variant="outline">
                Request New Invitation
              </Button>
              <p className="text-sm text-gray-500">
                Contact the chatbot administrator for a new invitation link.
              </p>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-600" />
            <h2 className="mt-4 text-xl font-semibold text-red-800">Verification Failed</h2>
            <p className="mt-2 text-gray-600">{message}</p>
            <div className="mt-6 space-y-3">
              <Button onClick={initializeAndVerify} variant="outline">
                Try Again
              </Button>
              <Button onClick={handleRequestNewInvitation} variant="ghost">
                Request New Invitation
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold">ChatFactory</Link>
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
            <CardTitle className="text-2xl font-bold text-gray-900">
              Set Your Password
            </CardTitle>
            <CardDescription>
              {chatbotName ? 
                `Complete your registration for ${chatbotName}` : 
                'Complete your registration'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {renderContent()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function EmailVerificationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    }>
      <EmailVerificationContent />
    </Suspense>
  );
}
