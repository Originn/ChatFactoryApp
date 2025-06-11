import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { EmailService } from '@/services/emailService';
import { FirebaseDbService } from '@/services/firebaseDbService';
import * as admin from 'firebase-admin';

export interface InviteUserRequest {
  chatbotId: string;
  email: string;
  displayName?: string;
  creatorUserId: string;
  role?: 'user' | 'admin';
  deploymentUrl?: string; // The URL of the deployed chatbot for verification links
}

export interface RemoveUserRequest {
  chatbotId: string;
  userId: string;
}

export interface ServiceResult {
  success: boolean;
  error?: string;
  userId?: string;
  verificationToken?: string;
}

export interface ChatbotUserProfile {
  id: string;
  email: string;
  displayName?: string;
  chatbotId: string;
  role: 'user' | 'admin';
  status: 'pending' | 'active' | 'disabled';
  invitedAt: Date;
  invitedBy: string;
  emailVerified: boolean;
  lastSignInAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ChatbotFirebaseService {
  
  /**
   * Get Firebase admin instances for user management
   * Returns both main project (for admin) and dedicated project (for runtime auth)
   */
  private static async getChatbotFirebaseInstances(chatbotId: string): Promise<{
    main: {
      auth: admin.auth.Auth;
      firestore: admin.firestore.Firestore;
      projectId: string;
    };
    dedicated?: {
      auth: admin.auth.Auth;
      firestore: admin.firestore.Firestore;
      projectId: string;
    };
  } | null> {
    try {
      const mainProject = {
        auth: adminAuth,
        firestore: adminDb,
        projectId: process.env.FIREBASE_PROJECT_ID || 'docsai-chatbot-app'
      };

      // Try to get dedicated project for runtime authentication
      let dedicatedProject;
      try {
        const deploymentsSnapshot = await adminDb
          .collection('deployments')
          .where('chatbotId', '==', chatbotId)
          .where('status', '==', 'deployed')
          .limit(1)
          .get();

        if (!deploymentsSnapshot.empty) {
          const deploymentData = deploymentsSnapshot.docs[0].data();
          const dedicatedProjectId = deploymentData.firebaseProjectId;
          
          if (dedicatedProjectId && dedicatedProjectId !== mainProject.projectId) {
            console.log(`🔥 Found dedicated Firebase project: ${dedicatedProjectId}`);
            
            const chatbotAppName = `chatbot-${chatbotId}`;
            let chatbotApp: admin.app.App;

            try {
              chatbotApp = admin.app(chatbotAppName);
            } catch (error) {
              chatbotApp = admin.initializeApp({
                credential: admin.credential.applicationDefault(),
                projectId: dedicatedProjectId
              }, chatbotAppName);
            }

            dedicatedProject = {
              auth: chatbotApp.auth(),
              firestore: chatbotApp.firestore(),
              projectId: dedicatedProjectId
            };
          }
        }
      } catch (error) {
        console.log(`ℹ️  Could not access dedicated project, will use main project only`);
      }

      return {
        main: mainProject,
        dedicated: dedicatedProject
      };

    } catch (error) {
      console.error('❌ Error getting Firebase instances:', error);
      return null;
    }
  }

  /**
   * Get main Firebase admin instance (for backwards compatibility)
   */
  private static async getChatbotFirebaseAdmin(chatbotId: string): Promise<{
    auth: admin.auth.Auth;
    firestore: admin.firestore.Firestore;
    projectId: string;
    isDedicatedProject: boolean;
  } | null> {
    try {
      return {
        auth: adminAuth,
        firestore: adminDb,
        projectId: process.env.FIREBASE_PROJECT_ID || 'docsai-chatbot-app',
        isDedicatedProject: false
      };
    } catch (error) {
      console.error('❌ Error getting Firebase admin:', error);
      return null;
    }
  }

  /**
   * Invite a user to a chatbot (creates user in the chatbot's dedicated Firebase project)
   */
  static async inviteUser(request: InviteUserRequest): Promise<ServiceResult> {
    try {
      const { email, displayName, chatbotId, creatorUserId, role = 'user', deploymentUrl } = request;
      
      console.log(`📧 Inviting user ${email} to chatbot ${chatbotId}`);
      
      // Get both main and dedicated Firebase instances
      const firebaseInstances = await this.getChatbotFirebaseInstances(chatbotId);
      if (!firebaseInstances) {
        return {
          success: false,
          error: 'Unable to access Firebase for this chatbot.'
        };
      }

      console.log(`🔄 Dual storage approach: Main project (admin backup) + ${firebaseInstances.dedicated ? 'Dedicated project (primary)' : 'Main project only'}`);
      
      let dedicatedUserId: string | undefined;
      
      // STEP 1: Create user in dedicated project (if available) for runtime authentication
      if (firebaseInstances.dedicated) {
        try {
          console.log(`🔥 Creating user in dedicated project ${firebaseInstances.dedicated.projectId} for chatbot authentication`);
          
          // First, ensure the dedicated project has a Firestore database
          console.log(`🔧 Ensuring Firestore database exists in dedicated project...`);
          const dbResult = await FirebaseDbService.ensureDefaultDatabase(firebaseInstances.dedicated.projectId);
          
          if (!dbResult.success) {
            console.error(`❌ Failed to create database in dedicated project:`, dbResult.error);
            throw new Error(`Database creation failed: ${dbResult.error}`);
          }
          
          console.log(`✅ Firestore database ready in dedicated project`);
          
          // Create user in dedicated project Firebase Auth
          let userRecord;
          try {
            userRecord = await firebaseInstances.dedicated.auth.getUserByEmail(email);
            console.log(`✅ User already exists in dedicated project with ID: ${userRecord.uid}`);
          } catch (error: any) {
            if (error.code === 'auth/user-not-found') {
              userRecord = await firebaseInstances.dedicated.auth.createUser({
                email: email,
                displayName: displayName || email.split('@')[0],
                emailVerified: false
              });
              console.log(`✅ New user created in dedicated project with ID: ${userRecord.uid}`);
            } else {
              throw error;
            }
          }
          
          dedicatedUserId = userRecord.uid;
          
          // STEP 2: Store user profile in dedicated project Firestore (PRIMARY storage)
          const dedicatedUserProfile = {
            id: userRecord.uid,
            email,
            displayName: displayName || email.split('@')[0],
            chatbotId,
            role: role,
            status: 'pending',
            invitedAt: new Date(),
            invitedBy: creatorUserId,
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          await firebaseInstances.dedicated.firestore
            .collection('users')
            .doc(userRecord.uid)
            .set(dedicatedUserProfile);

          console.log(`✅ User profile stored in dedicated project Firestore (PRIMARY storage)`);
          
        } catch (dedicatedError) {
          console.error(`❌ Failed to create user in dedicated project:`, dedicatedError);
          console.log(`🔄 Will proceed with main project only`);
        }
      }
      
      // STEP 3: Always create backup in main project for admin management
      const mainUserProfile = {
        id: dedicatedUserId || `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        email,
        displayName: displayName || email.split('@')[0],
        chatbotId,
        role: role,
        status: 'pending',
        invitedAt: new Date(),
        invitedBy: creatorUserId,
        emailVerified: false,
        dedicatedProjectUserId: dedicatedUserId, // Link to dedicated project user
        isDedicatedUser: !!dedicatedUserId, // Flag to indicate if user exists in dedicated project
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store backup in main project chatbot subcollection
      await firebaseInstances.main.firestore
        .collection('chatbots')
        .doc(chatbotId)
        .collection('users')
        .doc(mainUserProfile.id)
        .set(mainUserProfile);

      console.log(`✅ User backup stored in main project (ADMIN storage)`);

      // STEP 4: Generate verification token and send email
      const verificationToken = await this.generateVerificationTokenMainProject(
        mainUserProfile.id,
        chatbotId,
        firebaseInstances.main.firestore
      );

      await this.sendInvitationEmail(email, chatbotId, verificationToken, deploymentUrl);

      console.log(`✅ User ${email} invited to chatbot ${chatbotId}:`);
      console.log(`   📋 Main project (admin): ${mainUserProfile.id}`);
      if (dedicatedUserId) {
        console.log(`   🔥 Dedicated project (primary): ${dedicatedUserId}`);
        console.log(`   📊 Database ready for user management`);
      }
      
      return {
        success: true,
        userId: mainUserProfile.id,
        dedicatedUserId: dedicatedUserId,
        verificationToken: verificationToken
      };
      
    } catch (error: any) {
      console.error('❌ Error inviting user:', error);
      
      if (error.code === 'auth/email-already-exists') {
        return {
          success: false,
          error: 'User with this email is already registered in this chatbot'
        };
      }
      
      return {
        success: false,
        error: error.message || 'Failed to invite user'
      };
    }
  }

  /**
   * Remove a user from a chatbot (uses chatbot's dedicated Firebase project)
   */
  static async removeUser(request: RemoveUserRequest): Promise<ServiceResult> {
    try {
      const { userId, chatbotId } = request;
      
      console.log(`🗑️ Removing user ${userId} from chatbot ${chatbotId}`);
      
      // Get the Firebase admin instance (always main project)
      const firebaseInstance = await this.getChatbotFirebaseAdmin(chatbotId);
      if (!firebaseInstance) {
        return {
          success: false,
          error: 'Unable to access Firebase for this chatbot'
        };
      }

      // SIMPLIFIED: Always update in main project chatbot subcollection
      await firebaseInstance.firestore
        .collection('chatbots')
        .doc(chatbotId)
        .collection('users')
        .doc(userId)
        .update({
          status: 'disabled',
          updatedAt: new Date()
        });
      
      console.log(`✅ User ${userId} removed from chatbot ${chatbotId} in main project`);
      
      return {
        success: true
      };
      
    } catch (error: any) {
      console.error('❌ Error removing user:', error);
      return {
        success: false,
        error: error.message || 'Failed to remove user'
      };
    }
  }

  /**
   * Get users for a chatbot (from chatbot's dedicated Firebase project)
   */
  static async getChatbotUsers(chatbotId: string): Promise<{ success: boolean; users?: ChatbotUserProfile[]; error?: string }> {
    try {
      console.log(`📋 Getting users for chatbot ${chatbotId}`);
      
      // Get the Firebase admin instance (always main project)
      const firebaseInstance = await this.getChatbotFirebaseAdmin(chatbotId);
      if (!firebaseInstance) {
        return {
          success: false,
          error: 'Unable to access Firebase for this chatbot'
        };
      }

      // SIMPLIFIED: Always get users from main project chatbot subcollection
      const usersSnapshot = await firebaseInstance.firestore
        .collection('chatbots')
        .doc(chatbotId)
        .collection('users')
        .get();
      
      console.log(`📋 Getting users from main project chatbot subcollection`);

      const users: ChatbotUserProfile[] = usersSnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate?.() || new Date(),
            updatedAt: data.updatedAt?.toDate?.() || new Date(),
            invitedAt: data.invitedAt?.toDate?.() || new Date(),
            lastSignInAt: data.lastSignInAt?.toDate?.() || undefined
          } as ChatbotUserProfile;
        })
        .filter(user => user.status !== 'disabled'); // Filter out disabled users

      console.log(`✅ Found ${users.length} active users for chatbot ${chatbotId} in main project`);

      return {
        success: true,
        users: users
      };
      
    } catch (error: any) {
      console.error('❌ Error getting chatbot users:', error);
      return {
        success: false,
        error: error.message || 'Failed to get users'
      };
    }
  }

  /**
   * Verify user email and activate their chatbot access
   */
  static async verifyUserEmail(
    userId: string, 
    chatbotId: string, 
    verificationToken: string
  ): Promise<ServiceResult> {
    try {
      // Get both main and dedicated Firebase instances
      const firebaseInstances = await this.getChatbotFirebaseInstances(chatbotId);
      if (!firebaseInstances) {
        return {
          success: false,
          error: 'Unable to access Firebase for this chatbot'
        };
      }

      // ALWAYS verify token from main project's verification tokens
      const isValidToken = await this.verifyTokenMainProject(
        userId, 
        chatbotId, 
        verificationToken, 
        firebaseInstances.main.firestore
      );
      
      if (!isValidToken) {
        return {
          success: false,
          error: 'Invalid or expired verification token'
        };
      }

      // Get user profile from main project to check if they have a dedicated project user
      const userDoc = await firebaseInstances.main.firestore
        .collection('chatbots')
        .doc(chatbotId)
        .collection('users')
        .doc(userId)
        .get();
      
      const userData = userDoc.data();
      const dedicatedUserId = userData?.dedicatedProjectUserId;

      // Update user in dedicated project Firebase Auth if they exist there
      if (firebaseInstances.dedicated && dedicatedUserId) {
        try {
          // Update Firebase Auth
          await firebaseInstances.dedicated.auth.updateUser(dedicatedUserId, {
            emailVerified: true
          });
          
          // Update user profile in dedicated project Firestore (PRIMARY)
          await firebaseInstances.dedicated.firestore
            .collection('users')
            .doc(dedicatedUserId)
            .update({
              status: 'active',
              emailVerified: true,
              updatedAt: new Date()
            });
          
          console.log(`✅ Updated dedicated project user ${dedicatedUserId} as email verified (PRIMARY)`);
        } catch (dedicatedError) {
          console.error(`❌ Failed to update dedicated project user:`, dedicatedError);
          // Continue anyway - main project verification is more important for admin
        }
      }

      // Update user profile in the main project's chatbot subcollection (BACKUP)
      await firebaseInstances.main.firestore
        .collection('chatbots')
        .doc(chatbotId)
        .collection('users')
        .doc(userId)
        .update({
          status: 'active',
          emailVerified: true,
          updatedAt: new Date()
        });

      console.log(`✅ User ${userId} email verified for chatbot ${chatbotId}:`);
      console.log(`   📋 Main project (admin backup): Updated`);
      if (dedicatedUserId) {
        console.log(`   🔥 Dedicated project (primary): Updated`);
      }
      
      return { success: true };
      
    } catch (error: any) {
      console.error('❌ Error verifying user email:', error);
      return {
        success: false,
        error: error.message || 'Failed to verify email'
      };
    }
  }

  /**
   * Validate a verification token (used by API endpoints)
   */
  static async validateVerificationToken(
    token: string, 
    chatbotId: string
  ): Promise<{ 
    valid: boolean; 
    userId?: string; 
    expired?: boolean; 
    error?: string 
  }> {
    try {
      // Get the Firebase admin instance (always main project)
      const firebaseInstance = await this.getChatbotFirebaseAdmin(chatbotId);
      if (!firebaseInstance) {
        return {
          valid: false,
          error: 'Unable to access Firebase for this chatbot'
        };
      }

      // SIMPLIFIED: Always check token in the main project's verification tokens collection
      const tokenDoc = await firebaseInstance.firestore
        .collection('chatbot_verification_tokens')
        .doc(token)
        .get();

      if (!tokenDoc.exists) {
        return {
          valid: false,
          error: 'Invalid verification token'
        };
      }

      const tokenData = tokenDoc.data();
      const now = new Date();
      const expiresAt = tokenData?.expiresAt?.toDate?.() || new Date(0);

      if (now > expiresAt) {
        // Token expired, delete it
        await tokenDoc.ref.delete();
        
        return {
          valid: false,
          expired: true,
          error: 'Verification token has expired'
        };
      }

      // Check if token is for the correct chatbot
      if (tokenData?.chatbotId !== chatbotId) {
        return {
          valid: false,
          error: 'Invalid verification token for this chatbot'
        };
      }

      return {
        valid: true,
        userId: tokenData?.userId
      };
      
    } catch (error: any) {
      console.error('❌ Error validating verification token:', error);
      return {
        valid: false,
        error: error.message || 'Failed to validate token'
      };
    }
  }

  // Helper methods for email verification
  private static async generateVerificationTokenMainProject(
    userId: string, 
    chatbotId: string, 
    firestoreInstance: admin.firestore.Firestore
  ): Promise<string> {
    // Generate a secure token and store it temporarily in main project
    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    // Store token with expiration (24 hours) in main project's verification tokens collection
    await firestoreInstance
      .collection('chatbot_verification_tokens')
      .doc(token)
      .set({
        userId: userId,
        chatbotId: chatbotId,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      });

    return token;
  }

  private static async verifyTokenMainProject(
    userId: string, 
    chatbotId: string, 
    token: string,
    mainFirestore: admin.firestore.Firestore
  ): Promise<boolean> {
    try {
      const tokenDoc = await mainFirestore
        .collection('chatbot_verification_tokens')
        .doc(token)
        .get();

      if (!tokenDoc.exists) {
        return false;
      }

      const tokenData = tokenDoc.data();
      const now = new Date();
      const expiresAt = tokenData?.expiresAt?.toDate?.() || new Date(0);

      if (now > expiresAt) {
        // Token expired, delete it
        await mainFirestore.collection('chatbot_verification_tokens').doc(token).delete();
        return false;
      }

      const isValid = tokenData?.userId === userId && tokenData?.chatbotId === chatbotId;
      
      if (isValid) {
        // Delete token after successful verification
        await mainFirestore.collection('chatbot_verification_tokens').doc(token).delete();
      }

      return isValid;
    } catch (error) {
      console.error('❌ Error verifying token in main project:', error);
      return false;
    }
  }

  /**
   * Send invitation email using Firebase email verification link
   */
  private static async sendInvitationEmail(email: string, chatbotId: string, verificationToken: string, deploymentUrl?: string): Promise<void> {
    try {
      // Get chatbot details from main docsai project
      const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
      const chatbotData = chatbotDoc.data();
      
      // Get Firebase instances to use the dedicated project's auth
      const firebaseInstances = await this.getChatbotFirebaseInstances(chatbotId);
      if (!firebaseInstances?.dedicated) {
        console.log('⚠️ No dedicated Firebase project, using custom verification flow');
        // Fallback to custom verification
        const baseUrl = deploymentUrl || process.env.NEXT_PUBLIC_APP_URL;
        const verificationUrl = `${baseUrl}/email-verification?token=${verificationToken}&chatbot=${chatbotId}`;
        
        const result = await EmailService.sendChatbotInvitation(
          email,
          chatbotData?.name || 'Chatbot',
          verificationUrl
        );

        if (result.success) {
          console.log(`✅ Invitation email sent to ${email} (custom flow)`);
        } else {
          console.error(`❌ Failed to send email: ${result.error}`);
          throw new Error(result.error || 'Failed to send invitation email');
        }
        return;
      }

      // Use Firebase's built-in password reset link generation (for first-time password setup)
      console.log(`🔥 Generating Firebase password reset link for dedicated project: ${firebaseInstances.dedicated.projectId}`);
      
      // Configure ActionCodeSettings for the Vercel deployment - use actual deployment URL
      const baseUrl = deploymentUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://chatfactory.ai';
      const actionCodeSettings = {
        url: `${baseUrl}/email-verification?chatbot=${chatbotId}`,
        handleCodeInApp: false // Will open in browser first, then redirect to app
      };

      console.log(`🔗 Using password setup URL: ${actionCodeSettings.url}`);

      // Generate Firebase password reset link (this is the correct flow for first-time password setup)
      const passwordResetLink = await firebaseInstances.dedicated.auth.generatePasswordResetLink(
        email,
        actionCodeSettings
      );

      console.log(`✅ Firebase password reset link generated: ${passwordResetLink}`);

      // Send email using your email service with the Firebase link
      const result = await EmailService.sendChatbotInvitation(
        email,
        chatbotData?.name || 'Chatbot',
        passwordResetLink,
        'Admin' // inviterName
      );

      if (result.success) {
        console.log(`✅ Invitation email sent to ${email} with Firebase password reset link`);
      } else {
        console.error(`❌ Failed to send email: ${result.error}`);
        throw new Error(result.error || 'Failed to send invitation email');
      }
      
    } catch (error: any) {
      console.error('❌ Error sending invitation email:', error);
      
      // Provide more specific error messages
      if (error.code === 'auth/user-not-found') {
        throw new Error('User not found in Firebase Authentication');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address provided');
      } else if (error.message?.includes('domain')) {
        throw new Error('Domain not authorized for Firebase Authentication. Please add your Vercel domain to Firebase authorized domains.');
      }
      
      throw error;
    }
  }
}
