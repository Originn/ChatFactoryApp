'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  deleteUser,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword
} from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase/config';
import { UserProfile, SignupData, LoginData, UpdateUserProfileData } from '@/types/user';
import { UserService } from '@/services/userService';

interface AuthContextProps {
  // User state
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  
  // Authentication methods
  signInWithEmail: (data: LoginData) => Promise<User>;
  signInWithGoogle: () => Promise<User>;
  signUpWithEmail: (data: SignupData) => Promise<User>;
  signOut: () => Promise<void>;
  
  // Password management
  resetPassword: (email: string) => Promise<void>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  
  // Profile management
  updateProfile: (data: UpdateUserProfileData) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  
  // Email verification
  sendVerificationEmail: () => Promise<void>;
  
  // Utility functions
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Utility function to detect mobile devices with Safari-specific detection
  const isMobileDevice = () => {
    const result = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                   window.innerWidth <= 768;
    console.log('🔍 isMobileDevice:', result, 'UserAgent:', navigator.userAgent, 'Width:', window.innerWidth);
    return result;
  };

  // Specifically detect Safari on iOS
  const isSafariOnIOS = () => {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(userAgent);
    const result = isIOS && isSafari;
    console.log('🔍 isSafariOnIOS:', result, 'isIOS:', isIOS, 'isSafari:', isSafari, 'UserAgent:', userAgent);
    return result;
  };

  // Detect any iOS browser (Safari, Chrome, etc.) - they all need redirect handling
  const isIOSBrowser = () => {
    const userAgent = navigator.userAgent;
    const result = /iPad|iPhone|iPod/.test(userAgent);
    const deviceInfo = {
      isIPhone: /iPhone/.test(userAgent),
      isIPad: /iPad/.test(userAgent),
      isIPod: /iPod/.test(userAgent),
      isMacOS: /Macintosh/.test(userAgent),
      isIOS: result,
      screenWidth: window.screen?.width || 'unknown',
      screenHeight: window.screen?.height || 'unknown',
      windowWidth: window.innerWidth || 'unknown',
      windowHeight: window.innerHeight || 'unknown'
    };
    
    console.log('🔍 isIOSBrowser:', result, 'DeviceInfo:', deviceInfo, 'UserAgent:', userAgent);
    
    // Send debug info to server for all devices (not just iOS) to see what we're getting
    if (typeof window !== 'undefined') {
      fetch('/api/debug/iphone-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'isIOSBrowser_called',
          result,
          deviceInfo,
          userAgent,
          location: window.location.href,
          timestamp: new Date().toISOString()
        })
      }).catch(e => console.log('Debug log failed:', e));
    }
    
    return result;
  };

  // Load user profile when user changes
  const loadUserProfile = async (user: User | null) => {
    if (user) {
      try {
        const profile = await UserService.getUserProfile(user.uid);
        setUserProfile(profile);
        
        // Update login metadata
        if (profile) {
          await UserService.updateLoginMetadata(user.uid);
        }
      } catch (error) {
        console.warn('Could not load user profile from Firestore:', error);
        // Set userProfile to null but don't break authentication
        setUserProfile(null);
      }
    } else {
      setUserProfile(null);
    }
  };

  useEffect(() => {
    console.log('🚀 AuthContext useEffect: Setting up auth state listener');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔄 Auth state changed:', user ? `User: ${user.email}` : 'No user');
      console.log('📍 Current location:', window.location.pathname);
      console.log('🏁 Loading state before:', loading);
      
      // Send debug info to server about auth state changes
      if (typeof window !== 'undefined') {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        if (isIOS) {
          fetch('/api/debug/iphone-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'auth_state_changed',
              hasUser: !!user,
              userEmail: user?.email || null,
              currentPath: window.location.pathname,
              userAgent: navigator.userAgent,
              timestamp: new Date().toISOString()
            })
          }).catch(e => console.log('Debug log failed:', e));
        }
      }
      
      setUser(user);
      await loadUserProfile(user);
      setLoading(false);
      
      console.log('🏁 Loading state after:', false);
      
      // Clear OAuth redirect flag when user is authenticated
      if (user && typeof window !== 'undefined') {
        console.log('🧹 Clearing oauth_redirect_pending flag');
        sessionStorage.removeItem('oauth_redirect_pending');
      }
      
      // Handle redirect for all iOS browsers and login page variants
      const shouldRedirect = user && typeof window !== 'undefined' && 
          (window.location.pathname === '/login' || window.location.pathname.startsWith('/login'));
      
      console.log('🔀 Should redirect?', shouldRedirect);
      console.log('📱 Device detection - iOS:', isIOSBrowser(), 'Safari:', isSafariOnIOS(), 'Mobile:', isMobileDevice());
      
      if (shouldRedirect) {
        if (isIOSBrowser()) {
          // iOS browsers (Safari, Chrome, etc.) need more time to complete OAuth flow
          const delay = isSafariOnIOS() ? 1000 : 800; // Safari gets 1s, Chrome gets 0.8s
          console.log(`⏰ iOS browser detected, redirecting in ${delay}ms`);
          setTimeout(() => {
            console.log('🔀 Executing iOS redirect to dashboard');
            if (window.location.pathname === '/login' || window.location.pathname.startsWith('/login')) {
              window.location.href = '/dashboard';
            } else {
              console.log('❌ Path changed, skipping redirect. Current path:', window.location.pathname);
            }
          }, delay);
        } else {
          console.log('🔀 Non-iOS browser, redirecting immediately');
          window.location.href = '/dashboard';
        }
      }
    });

    // Handle redirect result for mobile Google sign-in
    const handleRedirectResult = async () => {
      console.log('🔄 Checking for redirect result...');
      try {
        const result = await getRedirectResult(auth);
        console.log('📨 Redirect result:', result ? `User: ${result.user?.email}` : 'No result');
        
        if (result && result.user) {
          console.log('✅ Got redirect result, handling Google auth...');
          // Handle the redirect result (create profile if needed)
          await handleGoogleAuthResult(result.user);
          
          // Clear OAuth redirect flag
          if (typeof window !== 'undefined') {
            console.log('🧹 Clearing oauth_redirect_pending flag from redirect result');
            sessionStorage.removeItem('oauth_redirect_pending');
          }
          
          // For iOS browsers, use delayed redirect to avoid race conditions  
          const shouldRedirectFromResult = typeof window !== 'undefined' && 
              (window.location.pathname === '/login' || window.location.pathname.startsWith('/login'));
          
          console.log('🔀 Should redirect from result?', shouldRedirectFromResult);
          
          if (shouldRedirectFromResult) {
            if (isIOSBrowser()) {
              const delay = isSafariOnIOS() ? 1500 : 1000; // Safari gets 1.5s, Chrome gets 1s
              console.log(`⏰ iOS redirect result, redirecting in ${delay}ms`);
              setTimeout(() => {
                console.log('🔀 Executing iOS redirect result to dashboard');
                if (window.location.pathname === '/login' || window.location.pathname.startsWith('/login')) {
                  window.location.href = '/dashboard';
                } else {
                  console.log('❌ Path changed during redirect result, skipping. Current path:', window.location.pathname);
                }
              }, delay);
            } else {
              console.log('🔀 Non-iOS redirect result, redirecting immediately');
              window.location.href = '/dashboard';
            }
          }
        } else {
          console.log('ℹ️ No redirect result found');
        }
      } catch (error) {
        console.error('❌ Redirect result error:', error);
        // Clear flag on error too
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('oauth_redirect_pending');
        }
      }
    };

    handleRedirectResult();
    return () => unsubscribe();
  }, []);

  // Sign up with email and password
  const signUpWithEmail = async (data: SignupData): Promise<User> => {
    const { email, password, displayName } = data;
    
    const result = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update display name
    await updateProfile(result.user, { displayName });
    
    // Create user profile in Firestore (with error handling)
    try {
      await UserService.createUserProfile(result.user.uid, {
        email,
        displayName,
        emailVerified: result.user.emailVerified
      });
    } catch (error) {
      console.warn('Could not create user profile in Firestore:', error);
      // Continue with signup even if profile creation fails
    }
    
    // Send email verification
    await sendEmailVerification(result.user);
    
    return result.user;
  };

  // Sign in with email and password
  const signInWithEmail = async (data: LoginData): Promise<User> => {
    const result = await signInWithEmailAndPassword(auth, data.email, data.password);
    return result.user;
  };

  // Helper function to handle Google auth result
  const handleGoogleAuthResult = async (user: User) => {
    try {
      const existingProfile = await UserService.getUserProfile(user.uid);
      if (!existingProfile) {
        await UserService.createUserProfile(user.uid, {
          email: user.email || '',
          displayName: user.displayName || '',
          emailVerified: user.emailVerified
        });
      }
    } catch (error) {
      console.warn('Could not create user profile in Firestore:', error);
    }
  };

  // Sign in with Google (mobile-aware with iOS-specific handling)
  const signInWithGoogle = async (): Promise<User> => {
    console.log('🚀 signInWithGoogle called');
    
    // Send debug info to server for all signInWithGoogle attempts
    if (typeof window !== 'undefined') {
      fetch('/api/debug/iphone-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'signInWithGoogle_called',
          userAgent: navigator.userAgent,
          location: window.location.href,
          timestamp: new Date().toISOString()
        })
      }).catch(e => console.log('Debug log failed:', e));
    }
    
    try {
      const shouldUseRedirect = isMobileDevice() || isIOSBrowser();
      console.log('🔀 Should use redirect?', shouldUseRedirect);
      
      if (shouldUseRedirect) {
        console.log('📱 Using redirect flow for mobile/iOS');
        // Use redirect for mobile devices and iOS browsers
        await signInWithRedirect(auth, googleProvider);
        console.log('✅ signInWithRedirect called successfully');
        
        // For iOS browsers, we need to handle the redirect differently
        if (isIOSBrowser()) {
          console.log('🍎 iOS browser detected, throwing REDIRECT_INITIATED');
          
          // Send debug info to server about redirect initiation
          if (typeof window !== 'undefined') {
            fetch('/api/debug/iphone-auth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'iOS_redirect_initiated',
                userAgent: navigator.userAgent,
                location: window.location.href,
                timestamp: new Date().toISOString()
              })
            }).catch(e => console.log('Debug log failed:', e));
          }
          
          // iOS browsers handle redirects differently, so we just initiate the redirect
          // The actual sign-in will be handled by the redirect result in useEffect
          // We don't return a promise here as iOS browsers will navigate away
          throw new Error('REDIRECT_INITIATED');
        }
        
        console.log('📱 Non-iOS mobile, using promise-based approach');
        // For other mobile devices, use the promise-based approach with longer timeout
        return new Promise((resolve, reject) => {
          console.log('⏱️ Setting up 30s timeout for mobile auth');
          const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
              console.log('✅ Mobile auth success:', user.email);
              unsubscribe();
              resolve(user);
            }
          });
          
          // Longer timeout for mobile devices (30 seconds)
          setTimeout(() => {
            console.log('⏰ Mobile auth timeout after 30s');
            unsubscribe();
            reject(new Error('Sign-in timeout - please try again'));
          }, 30000);
        });
      } else {
        console.log('🖥️ Using popup flow for desktop');
        // Use popup for desktop browsers
        const result = await signInWithPopup(auth, googleProvider);
        console.log('✅ Popup auth success:', result.user?.email);
        await handleGoogleAuthResult(result.user);
        return result.user;
      }
    } catch (error) {
      // Don't log redirect initiation as an error
      if (error instanceof Error && error.message === 'REDIRECT_INITIATED') {
        console.log('🔀 REDIRECT_INITIATED - this is expected for iOS');
        throw error; // Re-throw to be handled by the calling component
      }
      console.error('❌ Google sign-in error:', error);
      throw error;
    }
  };

  // Sign out
  const signOut = async (): Promise<void> => {
    await firebaseSignOut(auth);
  };

  // Reset password
  const resetPassword = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email);
  };

  // Update password
  const updateUserPassword = async (
    currentPassword: string, 
    newPassword: string
  ): Promise<void> => {
    if (!user || !user.email) {
      throw new Error('No authenticated user');
    }
    
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
  };

  // Update user profile
  const updateUserProfile = async (data: UpdateUserProfileData): Promise<void> => {
    if (!user) {
      throw new Error('No authenticated user');
    }

    // Update Firebase Auth profile
    if (data.displayName) {
      await updateProfile(user, { displayName: data.displayName });
    }

    // Update Firestore profile (with error handling)
    try {
      await UserService.updateUserProfile(user.uid, data);
    } catch (error) {
      console.warn('Could not update user profile in Firestore:', error);
      // Continue anyway, Firebase Auth profile was updated
    }
    
    // Refresh local profile
    await refreshUserProfile();
  };

  // Delete account
  const deleteAccount = async (password: string): Promise<void> => {
    if (!user || !user.email) {
      throw new Error('No authenticated user');
    }

    // Reauthenticate before deletion
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);
    
    // Delete user profile from Firestore
    await UserService.deleteUserProfile(user.uid);
    
    // Delete Firebase Auth user
    await deleteUser(user);
  };

  // Send email verification
  const sendVerificationEmail = async (): Promise<void> => {
    if (!user) {
      throw new Error('No authenticated user');
    }
    await sendEmailVerification(user);
  };

  // Refresh user profile
  const refreshUserProfile = async (): Promise<void> => {
    if (user) {
      await loadUserProfile(user);
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    signInWithEmail,
    signInWithGoogle,
    signUpWithEmail,
    signOut,
    resetPassword,
    updateUserPassword,
    updateProfile: updateUserProfile,
    deleteAccount,
    sendVerificationEmail,
    refreshUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
