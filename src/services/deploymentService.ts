// src/services/deploymentService.ts
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  getDoc,
  increment
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { DeploymentRecord, QueryUsageRecord, PLAN_LIMITS } from '@/types/deployment';
import { UpdatedUserProfile } from '@/types/deployment';
import { UserService } from './userService';
import { ChatbotConfig } from '@/types/chatbot';
import { PineconeService } from './pineconeService';
import { FirebaseAPIService } from './firebaseAPIService';
import { GoogleOAuthClientManager } from './googleOAuthClientManager';
import { FirebaseAuthConfigService } from './firebaseAuthSetup';

interface DeploymentOptions {
  chatbot: ChatbotConfig;
  user: UpdatedUserProfile;
  customDomain?: string;
}

interface DeploymentResult {
  success: boolean;
  deploymentId?: string;
  deploymentUrl?: string;
  error?: string;
  limitations?: string[];
}

class DeploymentService {
  private static readonly DEPLOYMENTS_COLLECTION = 'deployments';
  private static readonly QUERY_USAGE_COLLECTION = 'queryUsage';
  private static readonly USAGE_STATS_COLLECTION = 'deploymentUsageStats';

  /**
   * Check if user can deploy based on their plan and usage
   */
  static async canUserDeploy(user: UpdatedUserProfile): Promise<{
    canDeploy: boolean;
    reason?: string;
    limitations: string[];
  }> {
    const planLimits = PLAN_LIMITS[user.subscription.plan];
    const limitations: string[] = [];

    // Check chatbot limit
    if (planLimits.maxChatbots !== -1 && user.usage.chatbotsCreated >= planLimits.maxChatbots) {
      return {
        canDeploy: false,
        reason: `${user.subscription.plan} plan allows maximum ${planLimits.maxChatbots} chatbots. You have ${user.usage.chatbotsCreated}.`,
        limitations: ['Upgrade to increase chatbot limit']
      };
    }

    // Check monthly deployment limit
    const deploymentCount = await this.getMonthlyDeploymentCount(user.uid);
    if (planLimits.monthlyDeployments !== -1 && deploymentCount >= planLimits.monthlyDeployments) {
      return {
        canDeploy: false,
        reason: `${user.subscription.plan} plan allows ${planLimits.monthlyDeployments} deployments per month. You've used ${deploymentCount}.`,
        limitations: ['Upgrade for more deployments']
      };
    }

    // Add plan limitations
    if (user.subscription.plan === 'free') {
      limitations.push(
        'Vercel subdomain only (no custom domain)',
        '"Powered by ChatFactory" branding included',
        `${planLimits.monthlyQueries} queries per month limit`,
        `Analytics limited to ${planLimits.analyticsRetention} days`
      );
    }

    return { canDeploy: true, limitations };
  }

  /**
   * Deploy chatbot to Vercel with dedicated Firebase project
   */
  static async deployToVercel(options: DeploymentOptions): Promise<DeploymentResult> {
    const { chatbot, user, customDomain } = options;
    
    try {
      // Check deployment eligibility
      const eligibility = await this.canUserDeploy(user);
      if (!eligibility.canDeploy) {
        return {
          success: false,
          error: eligibility.reason,
          limitations: eligibility.limitations
        };
      }

      console.log('🚀 Starting deployment for chatbot:', chatbot.id);

      // Step 1: Create dedicated Firebase project
      console.log('🔥 Creating dedicated Firebase project...');
      const firebaseResult = await FirebaseAPIService.createProjectForChatbot({
        chatbotId: chatbot.id,
        chatbotName: chatbot.name,
        creatorUserId: user.uid
      });

      if (!firebaseResult.success) {
        return {
          success: false,
          error: `Failed to create Firebase project: ${firebaseResult.error}`,
          limitations: []
        };
      }

      console.log('✅ Firebase project created:', firebaseResult.project?.projectId);

      // Step 1.5: Setup OAuth and Firebase Authentication
      const projectId = firebaseResult.project!.projectId;
      const subdomain = this.generateSubdomain(chatbot.name);
      const deploymentUrl = customDomain || `${subdomain}.vercel.app`;

      console.log('🔐 Setting up OAuth and Firebase authentication...');
      const authResult = await this.setupChatbotAuthentication(
        projectId,
        chatbot.name,
        deploymentUrl
      );

      if (!authResult.success) {
        console.error('❌ Authentication setup failed:', authResult.error);
        // Continue deployment but log the auth failure
        console.warn('⚠️ Chatbot will be deployed without Google OAuth authentication');
      } else {
        console.log('✅ Authentication setup completed successfully');
      }

      // Create deployment record with Firebase project info
      const deploymentRecord: Omit<DeploymentRecord, 'id'> = {
        chatbotId: chatbot.id,
        userId: user.uid,
        status: 'deploying',
        subdomain,
        deploymentUrl,
        customDomain,
        
        // Firebase project information
        firebaseProjectId: firebaseResult.project!.projectId,
        firebaseConfig: firebaseResult.project!.config,
        
        branding: {
          show: PLAN_LIMITS[user.subscription.plan].branding,
          text: 'Powered by ChatFactory',
          link: 'https://chatfactory.ai'
        },
        
        planLimitations: {
          monthlyQueryLimit: PLAN_LIMITS[user.subscription.plan].monthlyQueries,
          analyticsRetention: PLAN_LIMITS[user.subscription.plan].analyticsRetention,
          customDomain: PLAN_LIMITS[user.subscription.plan].customDomain,
          branding: PLAN_LIMITS[user.subscription.plan].branding
        },
        
        usage: {
          totalQueries: 0,
          monthlyQueries: 0,
          lastResetAt: Timestamp.now()
        },
        
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        
        environmentVariables: this.prepareEnvironmentVariables(chatbot, user, firebaseResult.project!, authResult)
      };

      // Create Pinecone index for the chatbot
      console.log('🗄️ Creating Pinecone vectorstore for chatbot:', chatbot.id);
      
      try {
        // Use backward compatibility method that generates index name from chatbot ID
        const pineconeResult = await PineconeService.createIndexFromChatbotId(chatbot.id, chatbot.userId || 'unknown');
        
        if (!pineconeResult.success) {
          console.error('❌ Failed to create Pinecone index:', pineconeResult.error);
          console.error('❌ This will affect document search functionality for the deployed chatbot');
          // Continue deployment but the chatbot won't have vector search capability
        } else {
          console.log('✅ Successfully created Pinecone index:', pineconeResult.indexName);
        }
      } catch (pineconeError) {
        console.error('❌ Pinecone service error during deployment:', pineconeError);
        console.error('❌ Chatbot will be deployed without vector search functionality');
        // Continue deployment - the chatbot can still work without vector search
      }

      // Save deployment record
      const deploymentRef = await addDoc(
        collection(db, this.DEPLOYMENTS_COLLECTION), 
        deploymentRecord
      );

      // Simulate Vercel deployment (replace with actual Vercel API call)
      const deploymentSuccess = await this.simulateVercelDeployment(deploymentRecord);
      
      if (deploymentSuccess) {
        // Update deployment status
        await updateDoc(deploymentRef, {
          status: 'deployed',
          deployedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });

        // Update user usage statistics
        await this.updateUserDeploymentUsage(user.uid);

        return {
          success: true,
          deploymentId: deploymentRef.id,
          deploymentUrl,
          limitations: eligibility.limitations
        };
      } else {
        // Mark deployment as failed
        await updateDoc(deploymentRef, {
          status: 'failed',
          lastError: {
            message: 'Deployment failed',
            code: 'DEPLOYMENT_ERROR',
            timestamp: Timestamp.now()
          },
          updatedAt: Timestamp.now()
        });

        return {
          success: false,
          error: 'Deployment to Vercel failed',
          limitations: []
        };
      }

    } catch (error) {
      console.error('Deployment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Deployment failed',
        limitations: []
      };
    }
  }

  /**
   * Get user's deployments
   */
  static async getUserDeployments(userId: string): Promise<DeploymentRecord[]> {
    const deploymentsRef = collection(db, this.DEPLOYMENTS_COLLECTION);
    const q = query(
      deploymentsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as DeploymentRecord));
  }

  /**
   * Get deployment by ID
   */
  static async getDeployment(deploymentId: string): Promise<DeploymentRecord | null> {
    const deploymentRef = doc(db, this.DEPLOYMENTS_COLLECTION, deploymentId);
    const deploymentSnap = await getDoc(deploymentRef);
    
    if (deploymentSnap.exists()) {
      return {
        id: deploymentSnap.id,
        ...deploymentSnap.data()
      } as DeploymentRecord;
    }
    return null;
  }

  /**
   * Delete deployment
   */
  static async deleteDeployment(deploymentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const deploymentRef = doc(db, this.DEPLOYMENTS_COLLECTION, deploymentId);
      
      // Mark as deleted instead of actually deleting (for audit trail)
      await updateDoc(deploymentRef, {
        status: 'deleted',
        updatedAt: Timestamp.now()
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to delete deployment:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete deployment'
      };
    }
  }

  /**
   * Track query usage
   */
  static async trackQueryUsage(
    deploymentId: string,
    query: string,
    response: string,
    metadata: {
      responseTime: number;
      tokensUsed: number;
      sessionId?: string;
      userAgent?: string;
      ipAddress?: string;
    }
  ): Promise<void> {
    try {
      // Get deployment details
      const deployment = await this.getDeployment(deploymentId);
      if (!deployment) {
        throw new Error('Deployment not found');
      }

      // Check if query should be counted against limits
      const shouldCount = deployment.planLimitations.monthlyQueryLimit !== -1 && 
                         deployment.usage.monthlyQueries < deployment.planLimitations.monthlyQueryLimit;

      // Create usage record
      const usageRecord: Omit<QueryUsageRecord, 'id'> = {
        deploymentId,
        chatbotId: deployment.chatbotId,
        userId: deployment.userId,
        query,
        response,
        timestamp: Timestamp.now(),
        responseTime: metadata.responseTime,
        tokensUsed: metadata.tokensUsed,
        sessionId: metadata.sessionId,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        planType: deployment.planLimitations.monthlyQueryLimit === -1 ? 'enterprise' : 
                 deployment.planLimitations.monthlyQueryLimit > 100 ? 'pro' : 'free',
        counted: shouldCount
      };

      // Save usage record
      await addDoc(collection(db, this.QUERY_USAGE_COLLECTION), usageRecord);

      // Update deployment usage counters
      if (shouldCount) {
        const deploymentRef = doc(db, this.DEPLOYMENTS_COLLECTION, deploymentId);
        await updateDoc(deploymentRef, {
          'usage.totalQueries': increment(1),
          'usage.monthlyQueries': increment(1),
          'usage.lastQueryAt': Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }

    } catch (error) {
      console.error('Failed to track query usage:', error);
    }
  }

  /**
   * Private helper methods
   */
  private static generateSubdomain(chatbotName: string): string {
    return chatbotName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30); // Vercel subdomain limit
  }

  private static async getMonthlyDeploymentCount(userId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const deploymentsRef = collection(db, this.DEPLOYMENTS_COLLECTION);
    const q = query(
      deploymentsRef,
      where('userId', '==', userId),
      where('createdAt', '>=', Timestamp.fromDate(startOfMonth))
    );
    
    const snapshot = await getDocs(q);
    return snapshot.size;
  }

  private static prepareEnvironmentVariables(
    chatbot: ChatbotConfig, 
    user: UpdatedUserProfile,
    firebaseProject: any,
    authResult?: {
      success: boolean;
      oauthClientId?: string;
      oauthClientSecret?: string;
      error?: string;
    }
  ): Record<string, string> {
    return {
      CHATBOT_ID: chatbot.id,
      CHATBOT_CONFIG: JSON.stringify(chatbot),
      PLAN_TYPE: user.subscription.plan,
      MONTHLY_QUERY_LIMIT: PLAN_LIMITS[user.subscription.plan].monthlyQueries.toString(),
      ANALYTICS_RETENTION: PLAN_LIMITS[user.subscription.plan].analyticsRetention.toString(),
      BRANDING_ENABLED: PLAN_LIMITS[user.subscription.plan].branding.toString(),
      
      // Dedicated Firebase project configuration
      NEXT_PUBLIC_FIREBASE_API_KEY: firebaseProject.config.apiKey,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: firebaseProject.config.authDomain,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: firebaseProject.config.projectId,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: firebaseProject.config.storageBucket,
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: firebaseProject.config.messagingSenderId,
      NEXT_PUBLIC_FIREBASE_APP_ID: firebaseProject.config.appId,
      
      // Server-side Firebase Admin for the dedicated project
      FIREBASE_PROJECT_ID: firebaseProject.config.projectId,
      FIREBASE_CLIENT_EMAIL: firebaseProject.serviceAccount?.clientEmail || '',
      FIREBASE_PRIVATE_KEY: firebaseProject.serviceAccount?.privateKey || '',
      
      // OAuth Configuration (if available)
      NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID: authResult?.oauthClientId || '',
      GOOGLE_OAUTH_CLIENT_SECRET: authResult?.oauthClientSecret || '',
      OAUTH_ENABLED: authResult?.success ? 'true' : 'false',
      
      DEPLOYMENT_WEBHOOK_URL: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/deployment`
    };
  }

  private static async simulateVercelDeployment(
    deployment: Omit<DeploymentRecord, 'id'>
  ): Promise<boolean> {
    // Simulate deployment time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate 95% success rate
    return Math.random() > 0.05;
  }

  private static async updateUserDeploymentUsage(userId: string): Promise<void> {
    // Update user's deployment usage stats
    await UserService.incrementUsage(userId, { chatbots: 1 });
    
    // Update deployment-specific usage
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      'usage.deploymentsCreated': increment(1),
      'usage.activeDeployments': increment(1),
      'usage.monthlyDeployments': increment(1),
      'usage.lastDeploymentAt': Timestamp.now(),
      updatedAt: Timestamp.now()
    });
  }

  /**
   * Setup OAuth and Firebase Authentication for new chatbot
   */
  private static async setupChatbotAuthentication(
    projectId: string,
    chatbotName: string,
    deploymentUrl: string
  ): Promise<{
    success: boolean;
    oauthClientId?: string;
    oauthClientSecret?: string;
    error?: string;
  }> {
    try {
      console.log('🔐 Setting up OAuth and Firebase authentication...');

      // Step 1: Create Google OAuth Client with proper redirect URIs
      const redirectUris = [
        `https://${projectId}.firebaseapp.com/__/auth/handler`,
        `https://${projectId}.web.app/__/auth/handler`,
        `http://localhost:3000/__/auth/handler`,
        `http://localhost:3001/__/auth/handler`,
        `http://localhost:5000/__/auth/handler`
      ];

      // Add deployment URL if it's different from Firebase hosting
      if (deploymentUrl && !deploymentUrl.includes('firebaseapp.com') && !deploymentUrl.includes('.web.app')) {
        redirectUris.push(`https://${deploymentUrl}/__/auth/handler`);
      }

      const oauthClient = await GoogleOAuthClientManager.createOAuthClient({
        projectId,
        clientId: `${projectId}-oauth-client`,
        displayName: `${chatbotName} OAuth Client`,
        description: `OAuth client for ${chatbotName} chatbot authentication`,
        allowedRedirectUris: redirectUris,
        allowedGrantTypes: ['AUTHORIZATION_CODE_GRANT', 'REFRESH_TOKEN_GRANT'],
        allowedScopes: [
          'https://www.googleapis.com/auth/cloud-platform',
          'openid',
          'email',
          'profile'
        ],
        clientType: 'CONFIDENTIAL_CLIENT'
      });

      if (!oauthClient) {
        return {
          success: false,
          error: 'Failed to create OAuth client'
        };
      }

      console.log('✅ OAuth client created:', oauthClient.clientId);

      // Step 2: Enable Firebase Authentication with the new OAuth client
      const authSetup = await FirebaseAuthConfigService.setupAuthenticationForChatbot({
        projectId,
        emailPasswordEnabled: true,
        googleConfig: {
          enabled: true,
          clientId: oauthClient.clientId,
          clientSecret: oauthClient.clientSecret
        }
      });

      if (!authSetup) {
        return {
          success: false,
          error: 'Failed to configure Firebase authentication'
        };
      }

      console.log('✅ Firebase authentication configured successfully');

      return {
        success: true,
        oauthClientId: oauthClient.clientId,
        oauthClientSecret: oauthClient.clientSecret
      };

    } catch (error) {
      console.error('❌ Authentication setup failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication setup failed'
      };
    }
  }
}

export { DeploymentService };
export type { DeploymentOptions, DeploymentResult };

  /**
   * Update OAuth redirect URIs after deployment completes
   */
  static async updateOAuthRedirectUris(
    deploymentId: string,
    actualDeploymentUrl: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const deployment = await this.getDeployment(deploymentId);
      if (!deployment) {
        return { success: false, error: 'Deployment not found' };
      }

      const projectId = deployment.firebaseProjectId;
      const oauthClientId = `${projectId}-oauth-client`;

      // Updated redirect URIs with the actual deployment URL
      const redirectUris = [
        `https://${projectId}.firebaseapp.com/__/auth/handler`,
        `https://${projectId}.web.app/__/auth/handler`,
        `https://${actualDeploymentUrl}/__/auth/handler`,
        `http://localhost:3000/__/auth/handler`,
        `http://localhost:3001/__/auth/handler`,
        `http://localhost:5000/__/auth/handler`
      ];

      const success = await GoogleOAuthClientManager.updateRedirectUris(
        projectId,
        oauthClientId,
        redirectUris
      );

      if (success) {
        console.log('✅ OAuth redirect URIs updated with actual deployment URL');
        
        // Update deployment record
        const deploymentRef = doc(db, this.DEPLOYMENTS_COLLECTION, deploymentId);
        await updateDoc(deploymentRef, {
          'oauthConfig.redirectUrisUpdated': true,
          'oauthConfig.actualDeploymentUrl': actualDeploymentUrl,
          updatedAt: Timestamp.now()
        });
        
        return { success: true };
      } else {
        return { success: false, error: 'Failed to update OAuth redirect URIs' };
      }

    } catch (error) {
      console.error('❌ Error updating OAuth redirect URIs:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }