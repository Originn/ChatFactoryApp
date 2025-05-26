// src/services/usageTrackingService.ts
import { 
  doc, 
  updateDoc, 
  getDoc, 
  Timestamp, 
  collection,
  getDocs,
  query,
  where 
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { UserProfile } from '@/types/user';

export class UsageTrackingService {
  private static readonly USERS_COLLECTION = 'users';
  private static readonly DEPLOYMENTS_COLLECTION = 'deployments';

  /**
   * Reset monthly usage for a user
   */
  static async resetMonthlyUsage(userId: string): Promise<void> {
    try {
      const userRef = doc(db, this.USERS_COLLECTION, userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error(`User ${userId} not found`);
      }

      const userData = userDoc.data() as UserProfile;
      
      // Reset monthly counters
      await updateDoc(userRef, {
        'usage.monthlyQueries': 0,
        'usage.monthlyDeployments': 0,
        'usage.lastResetAt': Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Also reset monthly usage in user's deployments
      await this.resetDeploymentMonthlyUsage(userId);

      console.log(`Successfully reset monthly usage for user: ${userId}`);
    } catch (error) {
      console.error(`Failed to reset monthly usage for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Reset monthly usage for all deployments belonging to a user
   */
  private static async resetDeploymentMonthlyUsage(userId: string): Promise<void> {
    try {
      const deploymentsRef = collection(db, this.DEPLOYMENTS_COLLECTION);
      const deploymentsQuery = query(
        deploymentsRef,
        where('userId', '==', userId),
        where('status', '==', 'deployed')
      );
      
      const deploymentsSnapshot = await getDocs(deploymentsQuery);
      
      const resetPromises = deploymentsSnapshot.docs.map(async (deploymentDoc) => {
        const deploymentRef = doc(db, this.DEPLOYMENTS_COLLECTION, deploymentDoc.id);
        await updateDoc(deploymentRef, {
          'usage.monthlyQueries': 0,
          'usage.lastResetAt': Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      });

      await Promise.all(resetPromises);
      
      console.log(`Reset monthly usage for ${deploymentsSnapshot.docs.length} deployments for user: ${userId}`);
    } catch (error) {
      console.error(`Failed to reset deployment usage for user ${userId}:`, error);
      // Don't throw here as this is secondary to the main user reset
    }
  }

  /**
   * Track query usage for a user
   */
  static async trackQueryUsage(
    userId: string,
    increment: number = 1
  ): Promise<void> {
    try {
      const userRef = doc(db, this.USERS_COLLECTION, userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error(`User ${userId} not found`);
      }

      const userData = userDoc.data() as UserProfile;
      
      await updateDoc(userRef, {
        'usage.totalQueries': userData.usage.totalQueries + increment,
        'usage.monthlyQueries': userData.usage.monthlyQueries + increment,
        updatedAt: Timestamp.now()
      });

    } catch (error) {
      console.error(`Failed to track query usage for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Track deployment creation for a user
   */
  static async trackDeploymentCreation(userId: string): Promise<void> {
    try {
      const userRef = doc(db, this.USERS_COLLECTION, userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error(`User ${userId} not found`);
      }

      const userData = userDoc.data() as UserProfile;
      
      await updateDoc(userRef, {
        'usage.deploymentsCreated': (userData.usage.deploymentsCreated || 0) + 1,
        'usage.activeDeployments': (userData.usage.activeDeployments || 0) + 1,
        'usage.monthlyDeployments': (userData.usage.monthlyDeployments || 0) + 1,
        'usage.lastDeploymentAt': Timestamp.now(),
        updatedAt: Timestamp.now()
      });

    } catch (error) {
      console.error(`Failed to track deployment creation for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if user has exceeded their monthly limits
   */
  static async checkUsageLimits(
    userId: string,
    planType: 'free' | 'pro' | 'enterprise' = 'free'
  ): Promise<{
    withinLimits: boolean;
    queriesUsed: number;
    queriesLimit: number;
    deploymentsUsed: number;
    deploymentsLimit: number;
  }> {
    try {
      const userRef = doc(db, this.USERS_COLLECTION, userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error(`User ${userId} not found`);
      }

      const userData = userDoc.data() as UserProfile;
      
      // Define limits based on plan
      const limits = {
        free: { queries: 100, deployments: 3 },
        pro: { queries: 2000, deployments: 20 },
        enterprise: { queries: -1, deployments: -1 } // unlimited
      };

      const planLimits = limits[planType];
      const queriesUsed = userData.usage.monthlyQueries || 0;
      const deploymentsUsed = userData.usage.monthlyDeployments || 0;

      const queriesWithinLimit = planLimits.queries === -1 || queriesUsed < planLimits.queries;
      const deploymentsWithinLimit = planLimits.deployments === -1 || deploymentsUsed < planLimits.deployments;

      return {
        withinLimits: queriesWithinLimit && deploymentsWithinLimit,
        queriesUsed,
        queriesLimit: planLimits.queries,
        deploymentsUsed,
        deploymentsLimit: planLimits.deployments
      };

    } catch (error) {
      console.error(`Failed to check usage limits for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get usage statistics for a user
   */
  static async getUserUsageStats(userId: string): Promise<{
    monthlyQueries: number;
    totalQueries: number;
    monthlyDeployments: number;
    totalDeployments: number;
    lastResetAt: Date | null;
  }> {
    try {
      const userRef = doc(db, this.USERS_COLLECTION, userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error(`User ${userId} not found`);
      }

      const userData = userDoc.data() as UserProfile;
      
      return {
        monthlyQueries: userData.usage.monthlyQueries || 0,
        totalQueries: userData.usage.totalQueries || 0,
        monthlyDeployments: userData.usage.monthlyDeployments || 0,
        totalDeployments: userData.usage.deploymentsCreated || 0,
        lastResetAt: userData.usage.lastResetAt?.toDate() || null
      };

    } catch (error) {
      console.error(`Failed to get usage stats for user ${userId}:`, error);
      throw error;
    }
  }
}
