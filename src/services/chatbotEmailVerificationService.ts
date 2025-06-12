/**
 * Chatbot Email Verification Service
 * 
 * Handles email verification for chatbot deployments with dedicated Firebase projects.
 * This service ensures proper Firebase configuration retrieval and authentication setup.
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  Auth, 
  signInWithEmailAndPassword, 
  updatePassword, 
  applyActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
  User
} from 'firebase/auth';
import { Firestore } from 'firebase/firestore';

export interface ChatbotFirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface EmailVerificationResult {
  success: boolean;
  user?: User;
  error?: string;
  needsPasswordSetup?: boolean;
}

export interface PasswordSetupResult {
  success: boolean;
  user?: User;
  error?: string;
}

export class ChatbotEmailVerificationService {
  private static firebaseApp: FirebaseApp | null = null;
  private static auth: Auth | null = null;
  private static db: Firestore | null = null;
  private static config: ChatbotFirebaseConfig | null = null;

  /**
   * Initialize Firebase for the specific chatbot
   */
  static async initializeChatbotFirebase(chatbotId: string): Promise<void> {
    try {
      console.log('🔧 Initializing Firebase for chatbot:', chatbotId);
      
      // Get Firebase configuration from the deployment
      const config = await this.getChatbotFirebaseConfig(chatbotId);
      
      if (!config) {
        throw new Error('Failed to retrieve Firebase configuration for chatbot');
      }

      // Validate the configuration
      if (!this.isValidFirebaseConfig(config)) {
        throw new Error('Invalid Firebase configuration received');
      }

      // Initialize Firebase app with a unique name for this chatbot
      const appName = `chatbot-${chatbotId}`;
      
      // Check if app already exists
      const existingApps = getApps();
      const existingApp = existingApps.find(app => app.name === appName);
      
      if (existingApp) {
        console.log('🔄 Using existing Firebase app for chatbot');
        this.firebaseApp = existingApp;
      } else {
        console.log('🆕 Creating new Firebase app for chatbot');
        this.firebaseApp = initializeApp(config, appName);
      }

      // Initialize Auth
      this.auth = getAuth(this.firebaseApp);
      
      // Initialize Firestore
      const { getFirestore } = await import('firebase/firestore');
      this.db = getFirestore(this.firebaseApp);
      
      this.config = config;
      
      console.log('✅ Firebase initialized successfully for chatbot');
      console.log('🔧 Firebase Config Debug:', {
        projectId: config.projectId,
        authDomain: config.authDomain,
        apiKey: config.apiKey.substring(0, 20) + '...',
        hasValidConfig: this.isValidFirebaseConfig(config)
      });
      
    } catch (error: any) {
      console.error('❌ Failed to initialize Firebase for chatbot:', error);
      throw new Error(`Firebase initialization failed: ${error.message}`);
    }
  }

  /**
   * Get Firebase configuration for the chatbot from the deployment
   */
  private static async getChatbotFirebaseConfig(chatbotId: string): Promise<ChatbotFirebaseConfig | null> {
    try {
      console.log('🔧 Getting Firebase config for chatbot:', chatbotId);
      
      // Method 1: Check if we're in a deployment environment with env vars (most common)
      if (typeof window !== 'undefined') {
        // Client-side: Try to get config from Next.js public env vars
        const config = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        };

        // Validate that we have the required fields
        if (config.apiKey && config.projectId && config.authDomain) {
          console.log('✅ Using environment Firebase config');
          console.log('🔑 API Key prefix:', config.apiKey.substring(0, 10) + '...');
          console.log('🌐 Auth Domain:', config.authDomain);
          return config as ChatbotFirebaseConfig;
        } else {
          console.warn('⚠️ Environment config incomplete:', {
            hasApiKey: !!config.apiKey,
            hasProjectId: !!config.projectId,
            hasAuthDomain: !!config.authDomain
          });
        }
      }

      // Method 2: Fallback to API call
      console.log('🔄 Fetching Firebase config from API...');
      const response = await fetch(`/api/chatbot/${chatbotId}/firebase-config`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.config && data.config.apiKey) {
          console.log('✅ Firebase config retrieved from API');
          console.log('🔑 API Key prefix:', data.config.apiKey.substring(0, 10) + '...');
          return data.config;
        } else {
          console.warn('⚠️ API returned incomplete config:', data);
        }
      } else {
        console.warn('⚠️ API call failed:', response.status, response.statusText);
      }

      console.error('❌ Could not retrieve Firebase config from any source');
      return null;
      
    } catch (error: any) {
      console.error('❌ Error getting Firebase config:', error);
      return null;
    }
  }

  /**
   * Validate Firebase configuration
   */
  private static isValidFirebaseConfig(config: any): boolean {
    const required = ['apiKey', 'authDomain', 'projectId'];
    
    for (const field of required) {
      if (!config[field] || config[field] === 'configured-via-api') {
        console.warn(`⚠️ Invalid or missing Firebase config field: ${field}`);
        return false;
      }
    }

    // Validate API key format
    if (!config.apiKey.startsWith('AIza')) {
      console.warn('⚠️ API key does not have expected Firebase format');
      return false;
    }

    return true;
  }

  /**
   * Verify email using Firebase action code
   */
  static async verifyEmail(actionCode: string): Promise<EmailVerificationResult> {
    try {
      if (!this.auth) {
        throw new Error('Firebase not initialized. Call initializeChatbotFirebase first.');
      }

      console.log('🔍 Email verification debug:', {
        hasAuth: !!this.auth,
        hasConfig: !!this.config,
        authDomain: this.config?.authDomain,
        projectId: this.config?.projectId
      });

      // Apply the action code to verify the email
      await applyActionCode(this.auth, actionCode);
      
      console.log('✅ Email verified successfully');
      
      return {
        success: true,
        needsPasswordSetup: true
      };
      
    } catch (error: any) {
      console.error('❌ Email verification failed:', error);
      
      let errorMessage = 'Email verification failed';
      if (error.code === 'auth/expired-action-code') {
        errorMessage = 'Verification link has expired';
      } else if (error.code === 'auth/invalid-action-code') {
        errorMessage = 'Invalid verification link';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Verify custom token and set up password (direct flow - bypasses Firebase hosted pages)
   */
  static async verifyCustomTokenAndSetupPassword(token: string, newPassword: string): Promise<PasswordSetupResult> {
    try {
      if (!this.auth || !this.db) {
        throw new Error('Firebase not initialized');
      }

      console.log('🔧 Verifying custom token for password setup:', token);

      // Get the token data from Firestore using client SDK
      const { getDoc, doc, updateDoc } = await import('firebase/firestore');
      
      const tokenDocRef = doc(this.db, 'passwordResetTokens', token);
      const tokenDoc = await getDoc(tokenDocRef);
      
      if (!tokenDoc.exists()) {
        return {
          success: false,
          error: 'Invalid or expired setup link. Please request a new invitation.'
        };
      }

      const tokenData = tokenDoc.data();
      
      // Check if token is expired
      if (tokenData?.expiresAt?.toDate() < new Date()) {
        return {
          success: false,
          error: 'This setup link has expired. Please request a new invitation.'
        };
      }

      // Check if token is already used
      if (tokenData?.used) {
        return {
          success: false,
          error: 'This setup link has already been used. Please request a new invitation.'
        };
      }

      const email = tokenData?.email;
      const tempPassword = tokenData?.tempPassword; // We'll need to store this
      
      if (!email) {
        return {
          success: false,
          error: 'Invalid setup link. Please request a new invitation.'
        };
      }

      console.log('✅ Custom token verified for email:', email);

      // Since we can't use Admin SDK on client side, we'll use a different approach
      // We'll create an API endpoint to handle the password update
      const response = await fetch('/api/auth/setup-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          newPassword: newPassword,
          email: email
        })
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to set up password'
        };
      }

      // Mark the token as used in both projects
      await updateDoc(tokenDocRef, {
        used: true,
        usedAt: new Date()
      });

      // Also mark as used in main project (for admin consistency)
      try {
        const response = await fetch('/api/auth/mark-token-used', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token })
        });
      } catch (markError) {
        console.warn('⚠️ Could not mark token as used in main project:', markError);
        // Continue anyway - the dedicated project token is marked as used
      }

      // Now sign in the user with their new password
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const userCredential = await signInWithEmailAndPassword(this.auth, email, newPassword);
      
      console.log('✅ User signed in successfully with new password');

      return {
        success: true,
        user: userCredential.user
      };

    } catch (error: any) {
      console.error('❌ Custom token verification failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to verify setup link'
      };
    }
  }

  /**
   * Set up password for verified user
   */
  static async setupPassword(email: string, password: string): Promise<PasswordSetupResult> {
    try {
      if (!this.auth) {
        throw new Error('Firebase not initialized');
      }

      console.log('🔧 Attempting to set password for email:', email);
      console.log('🔍 Current auth state:', {
        currentUser: !!this.auth.currentUser,
        email: this.auth.currentUser?.email || 'undefined',
        emailVerified: this.auth.currentUser?.emailVerified || 'undefined'
      });

      // Check if user is already signed in from email verification
      if (this.auth.currentUser && this.auth.currentUser.email === email) {
        console.log('✅ User already authenticated, updating password...');
        
        try {
          await updatePassword(this.auth.currentUser, password);
          console.log('✅ Password updated successfully');
          
          return {
            success: true,
            user: this.auth.currentUser
          };
        } catch (updateError: any) {
          console.error('❌ Password update failed:', updateError);
          
          // If password update fails, it might be because the user needs re-authentication
          if (updateError.code === 'auth/requires-recent-login') {
            console.log('🔄 User needs re-authentication, attempting sign in...');
            // This would happen on subsequent password changes, not first-time setup
            return {
              success: false,
              error: 'Please sign in again to change your password.'
            };
          }
          
          throw updateError;
        }
      }

      // If user is not signed in, this means we need a different approach
      // In Firebase, for first-time password setup after email verification,
      // we should use password reset flow instead of email verification flow
      console.log('⚠️ User not authenticated after email verification');
      console.log('💡 This indicates the invitation should use password reset flow instead of email verification');
      
      // Try to create a user account if it doesn't exist
      // This is a fallback approach - ideally the invitation process should handle this
      return {
        success: false,
        error: 'Unable to set password. The invitation process needs to be updated to use password reset flow instead of email verification. Please contact the administrator.'
      };
      
    } catch (error: any) {
      console.error('❌ Password setup failed:', error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/weak-password') {
        return {
          success: false,
          error: 'Password is too weak. Please choose a stronger password.'
        };
      } else if (error.code === 'auth/invalid-email') {
        return {
          success: false,
          error: 'Invalid email address.'
        };
      } else if (error.code === 'auth/user-not-found') {
        return {
          success: false,
          error: 'User account not found. Please request a new invitation.'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Failed to set up password'
      };
    }
  }

  /**
   * Handle password reset workflow
   */
  static async resetPassword(actionCode: string, newPassword: string): Promise<PasswordSetupResult> {
    try {
      if (!this.auth) {
        throw new Error('Firebase not initialized');
      }

      // Verify the password reset code first
      const email = await verifyPasswordResetCode(this.auth, actionCode);
      console.log('✅ Password reset code verified for:', email);

      // Confirm the password reset
      await confirmPasswordReset(this.auth, actionCode, newPassword);
      console.log('✅ Password reset completed');

      // Sign in the user with the new password
      const userCredential = await signInWithEmailAndPassword(this.auth, email, newPassword);
      
      return {
        success: true,
        user: userCredential.user
      };
      
    } catch (error: any) {
      console.error('❌ Password reset failed:', error);
      
      let errorMessage = 'Password reset failed';
      if (error.code === 'auth/expired-action-code') {
        errorMessage = 'Reset link has expired';
      } else if (error.code === 'auth/invalid-action-code') {
        errorMessage = 'Invalid reset link';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get current user
   */
  static getCurrentUser(): User | null {
    return this.auth?.currentUser || null;
  }

  /**
   * Sign out current user
   */
  static async signOut(): Promise<void> {
    if (this.auth) {
      await this.auth.signOut();
    }
  }
}
