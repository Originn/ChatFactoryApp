import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { 
  UserProfile, 
  CreateUserProfileData, 
  UpdateUserProfileData 
} from '@/types/user';

export class UserService {
  private static readonly COLLECTION = 'users';

  /**
   * Create a new user profile in Firestore
   */
  static async createUserProfile(
    uid: string, 
    data: CreateUserProfileData
  ): Promise<UserProfile> {
    const now = Timestamp.now();
    
    const userProfile: UserProfile = {
      uid,
      email: data.email,
      displayName: data.displayName,
      emailVerified: data.emailVerified || false,
      createdAt: now,
      updatedAt: now,
      subscription: {
        plan: 'free',
        status: 'active'
      },
      usage: {
        chatbotsCreated: 0,
        totalQueries: 0,
        monthlyQueries: 0,
        lastResetAt: now,
        // New deployment fields
        deploymentsCreated: 0,
        activeDeployments: 0,
        monthlyDeployments: 0
      },
      preferences: {
        theme: 'system',
        notifications: true,
        emailNotifications: true,
        marketingEmails: false
      },
      // Deployment preferences
      deploymentPreferences: {
        preferredRegion: 'us-east-1',
        notifications: {
          deploymentSuccess: true,
          usageLimits: true,
          monthlyReports: false
        }
      },
      metadata: {
        loginCount: 0
      }
    };

    const userRef = doc(db, this.COLLECTION, uid);
    await setDoc(userRef, userProfile);
    
    return userProfile;
  }

  /**
   * Get user profile by UID
   */
  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    const userRef = doc(db, this.COLLECTION, uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data() as UserProfile;
    }
    return null;
  }

  /**
   * Update user profile
   */
  static async updateUserProfile(
    uid: string, 
    data: UpdateUserProfileData
  ): Promise<void> {
    const userRef = doc(db, this.COLLECTION, uid);
    await updateDoc(userRef, {
      ...data,
      updatedAt: Timestamp.now()
    });
  }

  /**
   * Update user login metadata
   */
  static async updateLoginMetadata(
    uid: string, 
    ipAddress?: string, 
    userAgent?: string
  ): Promise<void> {
    const userRef = doc(db, this.COLLECTION, uid);
    const userProfile = await this.getUserProfile(uid);
    
    if (userProfile) {
      const updateData: any = {
        'metadata.lastLoginAt': Timestamp.now(),
        'metadata.loginCount': userProfile.metadata.loginCount + 1,
        updatedAt: Timestamp.now()
      };

      // Only include ipAddress and userAgent if they have values
      if (ipAddress) {
        updateData['metadata.ipAddress'] = ipAddress;
      }
      if (userAgent) {
        updateData['metadata.userAgent'] = userAgent;
      }

      await updateDoc(userRef, updateData);
    }
  }

  /**
   * Delete user profile
   */
  static async deleteUserProfile(uid: string): Promise<void> {
    const userRef = doc(db, this.COLLECTION, uid);
    await deleteDoc(userRef);
  }

  /**
   * Update user subscription
   */
  static async updateSubscription(
    uid: string, 
    subscription: Partial<UserProfile['subscription']>
  ): Promise<void> {
    const userRef = doc(db, this.COLLECTION, uid);
    await updateDoc(userRef, {
      subscription,
      updatedAt: Timestamp.now()
    });
  }

  /**
   * Update user usage stats
   */
  static async incrementUsage(
    uid: string, 
    increment: { chatbots?: number; queries?: number; deployments?: number }
  ): Promise<void> {
    const userRef = doc(db, this.COLLECTION, uid);
    const userProfile = await this.getUserProfile(uid);
    
    if (userProfile) {
      const updates: any = { updatedAt: Timestamp.now() };
      
      if (increment.chatbots) {
        updates['usage.chatbotsCreated'] = 
          userProfile.usage.chatbotsCreated + increment.chatbots;
      }
      
      if (increment.queries) {
        updates['usage.totalQueries'] = 
          userProfile.usage.totalQueries + increment.queries;
        updates['usage.monthlyQueries'] = 
          userProfile.usage.monthlyQueries + increment.queries;
      }

      if (increment.deployments) {
        updates['usage.deploymentsCreated'] = 
          (userProfile.usage.deploymentsCreated || 0) + increment.deployments;
        updates['usage.activeDeployments'] = 
          (userProfile.usage.activeDeployments || 0) + increment.deployments;
        updates['usage.monthlyDeployments'] = 
          (userProfile.usage.monthlyDeployments || 0) + increment.deployments;
        updates['usage.lastDeploymentAt'] = Timestamp.now();
      }
      
      await updateDoc(userRef, updates);
    }
  }
}
