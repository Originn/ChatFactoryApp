'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      await loadUserProfile(user);
      setLoading(false);
    });

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

  // Sign in with Google
  const signInWithGoogle = async (): Promise<User> => {
    const result = await signInWithPopup(auth, googleProvider);
    
    // Check if user profile exists, create if not (with error handling)
    try {
      const existingProfile = await UserService.getUserProfile(result.user.uid);
      if (!existingProfile) {
        await UserService.createUserProfile(result.user.uid, {
          email: result.user.email || '',
          displayName: result.user.displayName || '',
          emailVerified: result.user.emailVerified
        });
      }
    } catch (error) {
      console.warn('Could not create user profile in Firestore:', error);
      // Continue with login even if profile creation fails
      // This allows Google OAuth to work even with restrictive Firestore rules
    }
    
    return result.user;
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
