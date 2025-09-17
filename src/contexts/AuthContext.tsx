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
import { shouldUserBypassComingSoon } from '@/lib/bypass';

interface AuthContextProps {
  // User state
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;

  // Bypass state
  canBypassComingSoon: boolean;

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

  // Bypass management
  checkBypassStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [canBypassComingSoon, setCanBypassComingSoon] = useState(false);

  // Simple mobile detection
  const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
  };

  // Check bypass status
  const checkBypassStatus = async () => {
    try {
      // Check user-based bypass first
      if (user?.email && shouldUserBypassComingSoon(user.email)) {
        // User is whitelisted, set bypass token
        await fetch('/api/bypass-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            action: 'check-user'
          })
        });
        setCanBypassComingSoon(true);
        console.log('🟢 User bypass granted for:', user.email);
        return;
      }

      // Check IP-based bypass
      const response = await fetch('/api/bypass-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-ip' })
      });

      const result = await response.json();
      setCanBypassComingSoon(result.bypass || false);

      if (result.bypass) {
        console.log('🟢 IP bypass granted:', result.reason);
      } else {
        console.log('🔴 No bypass available:', result.reason);
      }
    } catch (error) {
      console.error('❌ Bypass check failed:', error);
      setCanBypassComingSoon(false);
    }
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

        // Check bypass status for authenticated user
        await checkBypassStatus();
      } catch (error) {
        console.warn('Could not load user profile from Firestore:', error);
        // Set userProfile to null but don't break authentication
        setUserProfile(null);
        // Still check bypass status even if profile load fails
        await checkBypassStatus();
      }
    } else {
      setUserProfile(null);
      // Check IP-based bypass even when not authenticated
      await checkBypassStatus();
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      await loadUserProfile(user);
      setLoading(false);
      
      // Handle redirect after authentication (avoid conflicts with popup auth)
      if (user && typeof window !== 'undefined') {
        const path = window.location.pathname;
        // Only auto-redirect for direct email login or page refresh scenarios
        if (path === '/login' && !window.opener) {
          setTimeout(() => {
            window.location.href = '/dashboard';
          }, 100);
        }
      }
    });

    // Handle any pending redirect results (for edge cases or cached states)
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          await handleGoogleAuthResult(result.user);
        }
      } catch (error) {
        console.error('Redirect result error:', error);
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

  // Sign in with Google - use popup for all devices (simplified like SolidCam)
  const signInWithGoogle = async (): Promise<User> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await handleGoogleAuthResult(result.user);
      return result.user;
    } catch (error) {
      console.error('Google sign-in error:', error);
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
    canBypassComingSoon,
    signInWithEmail,
    signInWithGoogle,
    signUpWithEmail,
    signOut,
    resetPassword,
    updateUserPassword,
    updateProfile: updateUserProfile,
    deleteAccount,
    sendVerificationEmail,
    refreshUserProfile,
    checkBypassStatus
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
