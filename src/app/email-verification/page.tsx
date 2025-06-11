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
  
  // URL Parameters
  const oobCode = searchParams.get('oobCode'); // Firebase action code
  const mode = searchParams.get('mode'); // Firebase action mode
  const chatbotId = searchParams.get('chatbot');
  const continueUrl = searchParams.get('continueUrl');
  const email = searchParams.get('email'); // For general verification

  useEffect(() => {
    initializeAndVerify();
  }, [oobCode, mode, chatbotId]);

  const initializeAndVerify = async () => {
    try {
      // Handle general email verification (legacy)
      if (email && !oobCode && !chatbotId) {
        setStatus('verified');
        setMessage('Please check your email for verification instructions.');
        return;
      }

      // Validate required parameters for chatbot verification
      if (!oobCode || !chatbotId) {
        setStatus('error');
        setMessage('Invalid verification link. Please check your email for the correct link.');
        return;
      }

      // Initialize Firebase for this specific chatbot
      console.log('🔧 Initializing Firebase for chatbot:', chatbotId);
      await ChatbotEmailVerificationService.initializeChatbotFirebase(chatbotId);
      console.log('✅ Firebase initialized successfully');

      // Get chatbot name for display
      try {
        const response = await fetch(`/api/chatbot/${chatbotId}`);
        if (response.ok) {
          const data = await response.json();
          setChatbotName(data.name || 'the chatbot');
        }
      } catch (nameError) {
        console.warn('Could not fetch chatbot name:', nameError);
        setChatbotName('the chatbot');
      }

      // Handle different Firebase auth modes
      if (mode === 'verifyEmail') {
        await handleEmailVerification();
      } else if (mode === 'resetPassword') {
        setStatus('password-setup');
        setMessage('Please set your new password below.');
      } else {
        // Default to email verification
        await handleEmailVerification();
      }

    } catch (error: any) {
      console.error('❌ Initialization error:', error);
      setStatus('error');
      setMessage('Failed to initialize verification process. Please try again.');
    }
  };

  const handleEmailVerification = async () => {
    try {
      if (!oobCode) {
        throw new Error('No verification code provided');
      }

      console.log('🔧 Processing Firebase action with mode:', mode);
      
      if (mode === 'resetPassword') {
        // This is a password reset link (for first-time password setup)
        console.log('🔧 Password reset mode detected - ready for password setup');
        setStatus('password-setup');
        setMessage('Please set your password to complete registration.');
      } else {
        // This is an email verification link (legacy flow)
        console.log('🔧 Email verification mode detected');
        
        // Verify the email using the action code
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
            setMessage('This verification link has expired. Please request a new invitation.');
          } else {
            setStatus('error');
            setMessage(result.error || 'Email verification failed');
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Email verification error:', error);
      setStatus('error');
      setMessage('Email verification failed. Please try again.');
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

      // Extract email from continue URL or prompt user
      let userEmail = '';
      if (continueUrl) {
        const urlParams = new URLSearchParams(continueUrl.split('?')[1] || '');
        userEmail = urlParams.get('email') || '';
      }
      
      if (!userEmail) {
        // Try to get email from the current user or show error
        const currentUser = ChatbotEmailVerificationService.getCurrentUser();
        if (currentUser?.email) {
          userEmail = currentUser.email;
        } else {
          setPasswordError('Could not determine email address. Please contact support.');
          setIsSettingPassword(false);
          return;
        }
      }

      let result;
      if (mode === 'resetPassword' && oobCode) {
        // Handle password reset (first-time password setup)
        console.log('🔧 Using password reset flow for first-time setup');
        result = await ChatbotEmailVerificationService.resetPassword(oobCode, password);
      } else {
        // Handle regular password setup (legacy flow)
        console.log('🔧 Using regular password setup flow');
        result = await ChatbotEmailVerificationService.setupPassword(userEmail, password);
      }

      if (result.success) {
        setStatus('verified');
        setMessage('Password set successfully! You can now access the chatbot.');
        
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
            <h2 className="mt-4 text-xl font-semibold">Verifying your email...</h2>
            <p className="mt-2 text-gray-600">Please wait while we verify your email address.</p>
          </div>
        );

      case 'password-setup':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
              <h2 className="mt-4 text-xl font-semibold text-green-800">
                {mode === 'resetPassword' ? 'Ready to Set Password!' : 'Email Verified!'}
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
                    Setting Password...
                  </>
                ) : (
                  'Set Password'
                )}
              </Button>
            </div>
          </div>
        );

      case 'verified':
        return (
          <div className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
            <h2 className="mt-4 text-xl font-semibold text-green-800">Success!</h2>
            <p className="mt-2 text-gray-600">{message}</p>
            {chatbotName && (
              <p className="mt-2 text-sm text-gray-500">
                You now have access to <strong>{chatbotName}</strong>
              </p>
            )}
            <Button onClick={handleContinue} className="mt-6">
              Continue to Chatbot
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
              {mode === 'resetPassword' ? 'Set Up Your Password' : 'Email Verification'}
            </CardTitle>
            <CardDescription>
              {chatbotName ? 
                (mode === 'resetPassword' ? 
                  `Setting up your password for ${chatbotName}` : 
                  `Verifying access to ${chatbotName}`
                ) : 
                (mode === 'resetPassword' ? 
                  'Setting up your password' : 
                  'Verifying your email address'
                )
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
