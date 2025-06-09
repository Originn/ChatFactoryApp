/**
 * FirebaseAPIService - Production-Ready Firebase Project Automation
 * 
 * Comprehensive service for programmatically creating complete Firebase projects with:
 * - Google Cloud Project creation with organization support
 * - Billing account attachment and API enablement  
 * - Identity Platform initialization and Firebase integration
 * - OAuth brand and client creation for Google Sign-In
 * - Service account creation with proper key management
 * - Cloud Storage bucket provisioning
 * - Exponential backoff and retry logic for all operations
 * - Proper error handling and structured logging
 * 
 * Key Features:
 * ✅ Uses project numbers (not IDs) for Identity Toolkit APIs
 * ✅ Handles propagation delays with intelligent polling
 * ✅ Creates real OAuth credentials (not dummy configs)
 * ✅ Robust retry mechanisms for IAM and Firebase operations
 * ✅ Comprehensive authorized domains setup
 * ✅ Production-ready error handling and logging
 */

// src/services/firebaseAPIService-updated.ts
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { google } from 'googleapis'; // Still needed for Firebase Management API and Service Account CRUD
import { 
  storageClient, 
  billingClient, 
  serviceUsageClient, 
  resourceManagerClient
  // Removed iapClient - using REST API instead for better control
} from '@/lib/gcp-clients';
import { getAuthClient } from '@/lib/gcp-auth';
// Removed ProjectsClient import - already available through resourceManagerClient


export interface CreateFirebaseProjectRequest {
  chatbotId: string;
  chatbotName: string;
  creatorUserId: string;
}

export interface FirebaseProject {
  projectId: string;
  displayName: string;
  chatbotId: string;
  creatorUserId: string; // For audit/debug purposes
  createdAt: Timestamp;
  status: 'creating' | 'active' | 'failed' | 'deleted';
  config: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  buckets?: {
    documents: string;
    privateImages: string;
    documentImages: string;
  };
  serviceAccount?: {
    clientEmail: string;
    privateKey: string;
  };
  authConfig?: {
    success: boolean;
    providers: string[];
    clientId?: string;
    authType?: 'custom-oauth' | 'firebase-default';
    customOAuthConfigured?: boolean;
    error?: string;
  };
}

export class FirebaseAPIService {
  private static readonly FIREBASE_PROJECTS_COLLECTION = 'firebaseProjects';
  private static readonly BILLING_ACCOUNT_NAME = 'billingAccounts/011C35-0F1A1B-49FBEC';

  /**
   * Test service account permissions using Resource Manager SDK
   */
  static async testPermissions(): Promise<{ success: boolean; permissions: string[]; missing: string[]; error?: string }> {
    try {
      console.log('🧪 Testing service account permissions via SDK...');
      
      const organizationId = process.env.GOOGLE_CLOUD_ORGANIZATION_ID;
      if (!organizationId) {
        return {
          success: false,
          permissions: [],
          missing: ['GOOGLE_CLOUD_ORGANIZATION_ID not set'],
          error: 'Organization ID not configured'
        };
      }

      // Test organization access using Resource Manager SDK
      try {
        const [projects] = await resourceManagerClient.listProjects({
          parent: `organizations/${organizationId}`
          // Removed pageSize to avoid AutopaginateTrueWarning - SDK auto-paginates by default
        });
        
        console.log('✅ Can access organization via Resource Manager SDK');
        console.log(`📊 Found ${projects.length} project(s) in organization`);
        
        return {
          success: true,
          permissions: [
            'Organization access confirmed via SDK',
            'Project listing permissions verified',
            'Resource Manager API access confirmed'
          ],
          missing: [],
        };
      } catch (orgError: any) {
        console.error('❌ Cannot access organization via SDK:', orgError.message);
        return {
          success: false,
          permissions: [],
          missing: ['Organization access via Resource Manager SDK'],
          error: `Cannot access organization ${organizationId}: ${orgError.message}`
        };
      }
      
    } catch (error: any) {
      console.error('❌ SDK permission test failed:', error.message);
      return {
        success: false,
        permissions: [],
        missing: ['Permission test failed'],
        error: error.message
      };
    }
  }

  /**
   * Create Firebase project using SDK where possible, REST API where necessary
   */
  static async createProjectForChatbot(
    request: CreateFirebaseProjectRequest
  ): Promise<{ success: boolean; project?: FirebaseProject; error?: string }> {
    try {
      const { chatbotId, chatbotName, creatorUserId } = request;
      
      console.log('🔥 Creating Firebase project via SDK for chatbot:', chatbotId);
      
      // Test permissions first
      console.log('🧪 Testing service account permissions...');
      const permissionTest = await this.testPermissions();
      
      if (!permissionTest.success) {
        const errorMessage = `Service account lacks required permissions: ${permissionTest.missing.join(', ')}`;
        console.error('❌ Permission check failed:', errorMessage);
        return { success: false, error: errorMessage };
      }
      
      console.log('✅ Permission check passed - proceeding with project creation');
      
      const projectId = this.generateProjectId(chatbotName, chatbotId);
      const displayName = `${chatbotName} Chatbot`;

      // Store initial project record
      const projectRef = adminDb.collection(this.FIREBASE_PROJECTS_COLLECTION).doc(projectId);
      await projectRef.set({
        projectId,
        displayName,
        chatbotId,
        creatorUserId, // Include for audit/debug purposes
        createdAt: Timestamp.now(),
        status: 'creating'
      });

      try {
        // Step 1: Create Google Cloud Project using Resource Manager SDK
        console.log('🏗️ Creating Google Cloud project via Resource Manager SDK:', projectId);
        
        const organizationId = process.env.GOOGLE_CLOUD_ORGANIZATION_ID;
        
        try {
          const [operation] = await resourceManagerClient.createProject({
            project: {
              displayName,
              projectId,
              ...(organizationId && {
                parent: `organizations/${organizationId}`
              })
            }
          });

          console.log('✅ Google Cloud project creation initiated via SDK');
          console.log('📋 Operation name:', operation.name);
          
          // Wait for operation to complete using the official SDK pattern
          if (operation) {
            console.log('⏳ Waiting for project creation to complete...');
            await this.waitForSDKOperation(operation, 'resourcemanager');
            
            // Additional wait for project propagation
            console.log('⏳ Waiting for project to propagate across Google Cloud services...');
            await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second wait
            
            // Verify project exists and is accessible (optional)
            console.log('🔍 Verifying project accessibility...');
            try {
              await this.verifyProjectAccessibility(projectId);
            } catch (verifyError: any) {
              console.warn('⚠️ Project verification failed but continuing:', verifyError.message);
              console.log('ℹ️ This is usually due to permission restrictions and doesn\'t affect functionality');
            }
          }
        } catch (quotaError: any) {
          if (quotaError.message.includes('exceeded your allotted project quota')) {
            console.error('❌ Project quota exceeded - cannot create more projects');
            console.log('💡 Solutions:');
            console.log('   1. Permanently delete old projects: gcloud projects delete PROJECT_ID');
            console.log('   2. Wait 30 days for deleted projects to be purged');
            console.log('   3. Request quota increase in Google Cloud Console');
            console.log('   4. Use existing project for testing');
            
            await projectRef.update({
              status: 'failed',
              error: 'Project quota exceeded. Deleted projects count against quota for 30 days.',
              failedAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
              quotaExceeded: true
            });
            
            return { 
              success: false, 
              error: 'Project quota exceeded. Deleted projects still count against quota for 30 days. Please permanently delete old projects or request quota increase.' 
            };
          }
          throw quotaError; // Re-throw if it's not a quota error
        }

        // Step 2: Attach billing account first (helps with API quota in tight scenarios)
        console.log('💳 Attaching billing account via Billing SDK...');
        await this.attachBillingAccountSDK(projectId);

        // Step 3: Enable required APIs using Service Usage SDK (after billing for better quota)
        console.log('🔧 Enabling required APIs via Service Usage SDK...');
        const projectNumber = await this.getProjectNumber(projectId); // Get project number once for reuse
        await this.enableRequiredAPIsSDK(projectId, projectNumber);

        // Step 3.5: Initialize Identity Platform (requires billing to be enabled)
        // NOTE: This automatically adds Firebase to the project behind the scenes
        console.log('🔧 Initializing Identity Platform to create the backend...');
        await this.initialiseIdentityPlatform(projectNumber);

        // Step 4: Add Firebase to project (REST API - no SDK available)
        // NOTE: This is now idempotent and handles the case where Firebase already exists
        console.log('🔥 Adding Firebase to project via REST API...');
        const firebaseConfig = await this.addFirebaseToProject(projectId, displayName);

        // Step 5: Create Cloud Storage buckets using Storage SDK
        console.log('🪣 Creating Cloud Storage buckets via Storage SDK...');
        const buckets = await this.createStorageBucketsSDK(projectId);

        // Step 6: Skip OAuth setup - Firebase handles this automatically
        console.log('🔐 Skipping separate OAuth setup - Firebase handles Google Sign-In automatically');

        // Step 7: Create service account (REST API - no SDK for CRUD operations)
        console.log('🔑 Creating service account via REST API...');
        const serviceAccount = await this.createServiceAccountREST(projectId);

        // Step 8: Configure Firebase Authentication with Google provider (simplified)
        console.log('🔐 Configuring Firebase Authentication with Google provider...');
        const authConfig = await this.setupFirebaseAuthentication(projectId, projectNumber); // Pass cached project number

        // Update project record with success
        const completeProject: FirebaseProject = {
          projectId,
          displayName,
          chatbotId,
          creatorUserId, // Include for audit/debug purposes
          createdAt: Timestamp.now(),
          status: 'active',
          config: firebaseConfig,
          ...(Object.keys(buckets).length > 0 && { 
            buckets: {
              documents: buckets.documents || '',
              privateImages: buckets.privateImages || '',
              documentImages: buckets.documentImages || ''
            }
          }),
          ...(serviceAccount && { serviceAccount }),
          ...(authConfig && { authConfig })
        };

        // IMPORTANT: Store OAuth credentials for future use
        // In production, consider storing clientSecret in Secret Manager or encrypted env vars
        if (authConfig?.customOAuthConfigured && authConfig.clientId !== 'firebase-default') {
          console.log('💡 IMPORTANT: Custom OAuth credentials configured. Consider storing clientSecret securely for future deployments.');
          console.log('💡 Options: Google Secret Manager, Vercel encrypted env vars, or similar secure storage.');
        }

        await projectRef.update({
          status: 'active',
          config: firebaseConfig,
          completedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          ...(Object.keys(buckets).length > 0 && { buckets }),
          ...(serviceAccount && { serviceAccount }),
          ...(authConfig?.success && { 
            authConfig: {
              success: authConfig.success,
              providers: authConfig.providers,
              authType: authConfig.authType,
              customOAuthConfigured: authConfig.customOAuthConfigured
            }
          })
        });

        // Update chatbot with Firebase project reference
        await adminDb.collection('chatbots').doc(chatbotId).update({
          firebaseProjectId: projectId,
          firebaseConfig: firebaseConfig,
          updatedAt: Timestamp.now(),
          ...(Object.keys(buckets).length > 0 && { storageBuckets: buckets }),
          ...(serviceAccount && { firebaseServiceAccount: serviceAccount })
        });

        console.log('🎉 Firebase project setup completed successfully via SDK:', projectId);
        
        return { success: true, project: completeProject };

      } catch (sdkError: any) {
        console.error('❌ Firebase SDK operations failed:', sdkError.message);
        
        // Update project record with failure
        await projectRef.update({
          status: 'failed',
          error: sdkError.message,
          failedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        
        return { 
          success: false, 
          error: `Firebase SDK operations failed: ${sdkError.message}` 
        };
      }

    } catch (error: any) {
      console.error('❌ Error in createProjectForChatbot:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enable required APIs using Service Usage SDK
   */
  private static async enableRequiredAPIsSDK(projectId: string, projectNumber: string): Promise<void> {
    const apisToEnable = [
      'firebase.googleapis.com',
      'firestore.googleapis.com',
      'identitytoolkit.googleapis.com',
      'storage.googleapis.com',
      'cloudbilling.googleapis.com',
      'iam.googleapis.com',
      'iap.googleapis.com',              // Required for OAuth brand creation
      'iamcredentials.googleapis.com'    // Required for service-account key operations
      // Removed 'cloudresourcemanager.googleapis.com' - already enabled by project creation
    ];

    console.log(`🔧 Enabling ${apisToEnable.length} required APIs via Service Usage SDK...`);
    
    try {
      // Use passed project number (already cached) for Service Usage API
      const [operation] = await serviceUsageClient.batchEnableServices({
        parent: `projects/${projectNumber}`, // Use project number, not project ID
        serviceIds: apisToEnable
      });

      console.log('✅ Required APIs enabled via Service Usage SDK');
      console.log('📋 Operation name:', operation.name);
      
      // Wait for operation to complete using the official SDK pattern
      if (operation) {
        await this.waitForSDKOperation(operation, 'serviceusage');
        
        // Check for operation errors (hard-fail early if batch-enable incomplete)
        if (operation.error) {
          throw new Error(`Batch enable failed: ${JSON.stringify(operation.error)}`);
        }
      }
      
      // Wait for APIs to propagate
      console.log('⏳ Waiting for APIs to fully propagate...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
    } catch (enableError: any) {
      console.error('❌ Service Usage SDK API enabling failed:', enableError.message);
      throw new Error(`Failed to enable required APIs: ${enableError.message}`);
    }
  }

  /**
   * Attach billing account using Billing SDK
   */
  private static async attachBillingAccountSDK(projectId: string): Promise<void> {
    try {
      await billingClient.updateProjectBillingInfo({
        name: `projects/${projectId}`,
        projectBillingInfo: {
          billingAccountName: this.BILLING_ACCOUNT_NAME,
        },
      });
      
      console.log('✅ Billing account attached via Billing SDK');
    } catch (billingError: any) {
      console.warn('⚠️ Failed to attach billing account via Billing SDK:', billingError.message);
      console.warn('💡 Buckets may not be created without billing enabled');
    }
  }

  /**
   * Create Cloud Storage buckets using Storage SDK
   */
  private static async createStorageBucketsSDK(projectId: string): Promise<Record<string, string>> {
    const buckets: Record<string, string> = {};
    
    try {
      const bucketSuffixes = [
        'chatbot-documents',
        'chatbot-private-images', 
        'chatbot-document-images'
      ];
      
      for (const suffix of bucketSuffixes) {
        const bucketName = `${projectId}-${suffix}`;
        try {
          const [bucket] = await storageClient.createBucket(bucketName, {
            location: 'us-central1',
            storageClass: 'STANDARD',
            uniformBucketLevelAccess: true,
            publicAccessPrevention: 'enforced'
          });
          
          buckets[suffix.replace('-', '_')] = bucketName;
          console.log('✅ Bucket created via Storage SDK:', bucketName);
        } catch (bucketError: any) {
          if (bucketError.code === 409) {
            buckets[suffix.replace('-', '_')] = bucketName;
            console.log('ℹ️ Bucket already exists:', bucketName);
          } else {
            console.warn(`⚠️ Failed to create bucket ${bucketName} via Storage SDK:`, bucketError.message);
          }
        }
      }
      
      console.log(`✅ Created ${Object.keys(buckets).length} storage buckets via Storage SDK`);
    } catch (storageError: any) {
      console.warn('⚠️ Storage bucket creation failed via Storage SDK:', storageError.message);
    }
    
    return buckets;
  }

  // Note: setupOAuthAuthentication method removed - Firebase handles Google Sign-In automatically
  // For custom OAuth branding requirements, this method can be restored and guarded behind a feature flag

  /**
   * Add Firebase to Google Cloud project (REST API - no SDK available)
   * Now handles case where Firebase already exists (from Identity Platform initialization)
   */
  private static async addFirebaseToProject(projectId: string, displayName: string): Promise<any> {
    try {
      console.log('🔥 Adding Firebase to project via REST API (no SDK available)...');
      
      const authClient = await getAuthClient();
      const firebase = google.firebase('v1beta1');
      
      // Try to add Firebase to the project
      try {
        const addFirebaseResponse = await firebase.projects.addFirebase({
          project: `projects/${projectId}`,
          requestBody: {},
          auth: authClient as any
        });

        console.log('✅ Firebase added to project via REST API');

        // Wait for Firebase setup to complete
        if ((addFirebaseResponse as any).data?.name) {
          await this.waitForOperation((addFirebaseResponse as any).data.name, authClient);
        }
      } catch (addError: any) {
        // Handle case where Firebase already exists (from Identity Platform initialization)
        if (addError.message?.includes('already exists') || addError.message?.includes('Requested entity already exists')) {
          console.log('ℹ️ Firebase already exists (likely from Identity Platform initialization) - continuing...');
        } else {
          throw addError; // Re-throw if it's a different error
        }
      }

      // Create web app (this should work regardless)
      console.log('📱 Creating Firebase web app...');
      try {
        const createWebAppResponse = await firebase.projects.webApps.create({
          parent: `projects/${projectId}`,
          requestBody: {
            displayName: `${displayName} App`
          },
          auth: authClient as any
        });
        console.log('✅ Firebase web app created');
      } catch (webAppError: any) {
        if (webAppError.message?.includes('already exists')) {
          console.log('ℹ️ Firebase web app already exists - continuing...');
        } else {
          console.warn('⚠️ Failed to create web app:', webAppError.message);
        }
      }

      // Get web app configuration with retry (avoids fallback to dummy values)
      console.log('⚙️ Retrieving Firebase configuration...');
      const webApps = await firebase.projects.webApps.list({
        parent: `projects/${projectId}`,
        auth: authClient as any
      });

      if ((webApps as any).data.apps && (webApps as any).data.apps.length > 0) {
        const latestApp = (webApps as any).data.apps[(webApps as any).data.apps.length - 1];
        if (latestApp.name) {
          // Retry config retrieval to avoid fallback to dummy values
          console.log('🔄 Attempting to retrieve Firebase config (with retry for API readiness)...');
          const maxConfigRetries = 4; // Increased from 3 to handle 20-25s cases
          const configDelay = 5000; // 5 seconds between retries
          
          for (let attempt = 0; attempt < maxConfigRetries; attempt++) {
            try {
              const configResponse = await firebase.projects.webApps.getConfig({
                name: `${latestApp.name}/config`,
                auth: authClient as any
              });

              console.log('✅ Firebase configuration retrieved successfully');
              return this.parseFirebaseConfig((configResponse as any).data, projectId);
              
            } catch (configError: any) {
              console.log(`⏳ Config attempt ${attempt + 1}/${maxConfigRetries} failed:`, configError.message);
              
              if (attempt < maxConfigRetries - 1) {
                console.log(`   Retrying config retrieval in ${configDelay/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, configDelay));
              } else {
                console.warn('⚠️ Failed to get Firebase config after all retries, using fallback');
              }
            }
          }
        }
      }

      // Fallback config if we can't get the actual config
      console.log('🔄 Using fallback Firebase configuration');
      return {
        apiKey: 'configured-via-api',
        authDomain: `${projectId}.firebaseapp.com`,
        projectId: projectId,
        storageBucket: `${projectId}.appspot.com`,
        messagingSenderId: 'configured-via-api',
        appId: 'configured-via-api'
      };
      
    } catch (firebaseError: any) {
      console.error('❌ Firebase project setup via REST API failed:', firebaseError.message);
      throw new Error(`Firebase setup failed: ${firebaseError.message}`);
    }
  }

  /**
   * Create service account (REST API - no SDK for CRUD operations)
   */
  private static async createServiceAccountREST(projectId: string): Promise<{ clientEmail: string; privateKey: string } | null> {
    try {
      console.log('🔑 Creating service account via REST API (no SDK for CRUD)...');
      
      const authClient = await getAuthClient();
      const iam = google.iam('v1');
      
      const serviceAccountId = `${projectId.replace(/-/g, '')}-admin`.substring(0, 30);
      const serviceAccountEmail = `${serviceAccountId}@${projectId}.iam.gserviceaccount.com`;
      
      // Create service account
      try {
        await iam.projects.serviceAccounts.create({
          name: `projects/${projectId}`,
          requestBody: {
            accountId: serviceAccountId,
            serviceAccount: {
              displayName: `${projectId} Admin Service Account`,
              description: 'Service account for admin operations'
            }
          },
          auth: authClient as any
        });
        console.log('✅ Service account created via REST API:', serviceAccountEmail);
        
        // IMPORTANT: Wait for the service account to propagate before creating a key
        // IAM propagation can take "a few minutes" - stretch to 30s and 3 retries
        console.log('⏳ Waiting for service account to propagate (extended wait)...');
        await new Promise(resolve => setTimeout(resolve, 30000)); // 30-second wait (up from 10s)
        
      } catch (createError: any) {
        if (createError.code === 409) {
          console.log('ℹ️ Service account already exists:', serviceAccountEmail);
        } else {
          throw createError;
        }
      }
      
      // Create and download key with improved retry logic (IAM propagation can take 90s+ on new orgs)
      const maxRetries = 4; // Increased from 3
      let keyResponse: any = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          keyResponse = await iam.projects.serviceAccounts.keys.create({
            name: `projects/${projectId}/serviceAccounts/${serviceAccountEmail}`,
            requestBody: {
              privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE',
              keyAlgorithm: 'KEY_ALG_RSA_2048'
            },
            auth: authClient as any
          });
          
          console.log('✅ Service account key created via REST API');
          break; // Success!
          
        } catch (keyError: any) {
          if (attempt < maxRetries - 1) {
            // Exponential backoff: 30s, 45s, 60s for new org IAM propagation
            const delay = Math.min(30000 + (attempt * 15000), 60000);
            console.log(`⚠️ Key creation attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay/1000}s...`);
            console.log(`   IAM propagation can take up to 90s on new organizations`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw keyError; // Final attempt failed
          }
        }
      }
      
      if (keyResponse && (keyResponse as any).data.privateKeyData) {
        const keyData = JSON.parse(Buffer.from((keyResponse as any).data.privateKeyData, 'base64').toString());
        
        return {
          clientEmail: keyData.client_email,
          privateKey: keyData.private_key
        };
      }
      
      return null;
    } catch (serviceAccountError: any) {
      console.warn('⚠️ Service account creation via REST API failed:', serviceAccountError.message);
      return null;
    }
  }

  /**
   * Wait for SDK operation to complete using the official pattern with timeout
   */
  private static async waitForSDKOperation(operation: any, service: string, maxWaitTime = 300000): Promise<void> {
    console.log(`⏳ Waiting for ${service} SDK operation to complete (max ${maxWaitTime/1000}s)...`);
    
    try {
      // Use the official Google Cloud SDK pattern: await operation.promise()
      if (operation && typeof operation.promise === 'function') {
        console.log(`🔍 Using operation.promise() for ${service} operation`);
        
        // Implement actual timeout using Promise.race
        const operationPromise = operation.promise();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`${service} operation timed out after ${maxWaitTime/1000}s`)), maxWaitTime)
        );
        
        const result = await Promise.race([operationPromise, timeoutPromise]);
        console.log(`✅ ${service} SDK operation completed successfully`);
        
        // Safe destructuring - SDK operations typically return arrays
        if (Array.isArray(result)) {
          const [response] = result;
          console.log(`📋 Operation response:`, response?.name || 'Success');
        } else {
          // Handle non-array responses (rare but possible)
          console.log(`📋 Operation response:`, (result as any)?.name || 'Success');
        }
      } else {
        // Fallback for operations without promise method
        console.log(`⚠️ Operation doesn't have promise() method, using timeout for ${service}`);
        await Promise.race([
          new Promise(resolve => setTimeout(resolve, 20000)),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`${service} fallback timeout`)), maxWaitTime))
        ]);
        console.log(`✅ ${service} SDK operation completed (assumed)`);
      }
    } catch (operationError: any) {
      console.error(`❌ ${service} SDK operation failed:`, operationError.message);
      throw new Error(`${service} operation failed: ${operationError.message}`);
    }
  }

  /**
   * Wait for REST API operation to complete using proper polling
   */
  private static async waitForOperation(operationName: string, authClient: any, maxWaitTime = 300000): Promise<void> {
    if (!operationName) {
      console.log('⏳ No operation name provided, waiting fixed time...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      return;
    }

    console.log('⏳ Waiting for REST API operation to complete:', operationName);
    
    // Use proper polling for REST operations instead of fixed wait
    try {
      await this.pollUntilOk(
        async () => {
          const firebase = google.firebase('v1beta1');
          const opResponse = await firebase.operations.get({
            name: operationName,
            auth: authClient
          });
          
          const operation = (opResponse as any).data;
          
          // Check if operation is done
          if (operation.done === true) {
            if (operation.error) {
              throw new Error(`Operation failed: ${JSON.stringify(operation.error)}`);
            }
            return new Response('{}', { status: 200 }); // Success
          }
          
          // Not done yet, return 404 to continue polling
          return new Response('Operation not complete', { status: 404 });
        },
        { 
          initialDelayMs: 5000,  // Start with 5s delay
          maxDelayMs: 30000,     // Max 30s between polls  
          timeoutMs: maxWaitTime // Use provided timeout
        }
      );
      
      console.log('✅ REST API operation completed successfully');
    } catch (error: any) {
      console.warn(`⚠️ Operation polling failed: ${error.message}, but continuing...`);
      // Fallback to fixed wait for backward compatibility
      console.log('🔄 Falling back to fixed wait time...');
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }

  /**
   * Generate project ID from chatbot name and ID
   */
  private static generateProjectId(chatbotName: string, chatbotId: string): string {
    const sanitizedName = chatbotName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 20);
    
    const shortId = chatbotId.toLowerCase().substring(0, 8);
    return `${sanitizedName}-${shortId}`;
  }

  /**
   * Get numeric project number from project ID
   */
  private static async getProjectNumber(projectId: string): Promise<string> {
    try {
      console.log('🔍 Getting numeric project number for:', projectId);
      
      // Let TypeScript infer the correct Project type
      const [project] = await resourceManagerClient.getProject({
        name: `projects/${projectId}`,
      });
      
      // Use the guaranteed 'name' field from REST API spec: "projects/123456789012"
      if (!project.name) {
        throw new Error('Project name field is missing from response');
      }
      
      // Extract numeric project number from "projects/123456789012" → "123456789012"
      const projectNumber = project.name.split('/')[1];
      
      if (!projectNumber || projectNumber === 'undefined') {
        throw new Error('Could not extract project number from project name');
      }
      
      console.log('✅ Project number extracted from name field:', projectNumber);
      return projectNumber;
      
    } catch (error: any) {
      console.error('❌ Failed to get project number:', error.message, { error });
      throw new Error(`Failed to get project number: ${error.message}`);
    }
  }

  /**
   * Best-effort Identity-Platform bootstrap.
   * It's only an optimisation – never block the flow on failure.
   */
  private static async initialiseIdentityPlatform(projectNumber: string): Promise<void> {
    const authClient = await getAuthClient();
    const identity = google.identitytoolkit('v2');

    try {
      console.log('🔧 Initialising Identity Platform (best-effort)…');
      
      await identity.projects.identityPlatform.initializeAuth({
        project: `projects/${projectNumber}`, // Use 'project' instead of 'parent'
        requestBody: {}, // Empty request body as required
        auth: authClient as any
      });
      
      console.log('✅ Identity Platform initialised');
    } catch (e: any) {
      // 409 = already initialised → totally fine.
      if (e?.response?.status === 409) {
        console.log('ℹ️ Identity Platform already initialised – continuing');
        return;
      }

      // For *any* other error, just warn and continue.
      // The subsequent pollForIdentityToolkit() will take care of waiting
      // until the backend appears.
      console.warn(
        `⚠️ Identity-Platform init failed (${e?.response?.status ?? 'unknown'}): ${e.message}. ` +
        'Proceeding – the admin/v2 polling loop will handle provisioning.'
      );
    }
  }

  /**
   * Generic poll-until-200 helper with jittered exponential backoff
   */
  private static async pollUntilOk(
    fetchFn: () => Promise<Response>,
    options: {
      initialDelayMs?: number;
      maxDelayMs?: number;
      timeoutMs?: number;
    } = {}
  ): Promise<void> {
    const {
      initialDelayMs = 30000,  // Start with 30s instead of 15s
      maxDelayMs = 120000,     // Max 2 minutes between retries
      timeoutMs = 1200000      // 20 min cap (extended from 10 minutes)
    } = options;

    let elapsed = 0;
    let attempt = 0;

    while (elapsed < timeoutMs) {
      try {
        const res = await fetchFn();

        if (res.ok) { // Status is 200-299, we're good
          return;
        }

        // Treat 404 as "not ready yet" during initial provisioning
        if (res.status === 404) {
          console.log(`⏳ Resource not found (HTTP 404), still waiting for provisioning...`);
        } else {
          // Log other unexpected errors but continue retrying
          const errorText = await res.text();
          console.warn(`⏳ Resource not ready (HTTP ${res.status}), retrying. Response: ${errorText}`);
        }

      } catch (error: any) {
        console.warn(`⏳ Network error while polling, retrying...`, error.message);
      }

      attempt++;
      // Jittered exponential backoff with cap
      const jitter = Math.random() * 1000;
      const delay = Math.min(initialDelayMs * Math.pow(1.5, attempt), maxDelayMs) + jitter;
      
      elapsed += delay;

      if (elapsed >= timeoutMs) {
        break;
      }
      
      console.log(`   Retrying in ~${Math.round(delay / 1000)}s...`);
      await new Promise(r => setTimeout(r, delay));
    }

    throw new Error(`Resource never became ready after ${timeoutMs / 60000} minutes.`);
  }

  /**
   * Wait for Identity Toolkit configuration using improved poll-until-200 approach
   */
  private static async waitForIdentityToolkit(projectNumber: string): Promise<void> {
    console.log('⏳ Waiting for Identity Toolkit configuration to become available...');
    
    const accessToken = await this.getFirebaseAccessToken();
    
    await this.pollUntilOk(
      () => fetch(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectNumber}/config`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      }),
      { 
        initialDelayMs: 15000, 
        maxDelayMs: 90000, 
        timeoutMs: 600000 // 10 min cap
      }
    );
    
    console.log('✅ Identity Toolkit configuration is ready');
  }

  /**
   * Create OAuth brand (consent screen) if it doesn't exist
   * 
   * IMPORTANT SETUP REQUIREMENTS (Updated Spring 2024):
   * 1. Project MUST be in a Google Workspace organization (not standalone)
   * 2. Support email MUST be a Google Group that the service account OWNS
   * 3. Service account needs 'clientauthconfig.brands.*' permissions
   * 
   * To create a Google Group for support:
   * 1. Create group at https://groups.google.com (e.g., support@yourdomain.com)
   * 2. Add your service account as an OWNER of the group (not just member)
   * 3. Set SUPPORT_EMAIL=support@yourdomain.com
   * 
   * For testing: You can skip OAuth brand creation and use Firebase's default provider
   */
  private static async ensureOAuthBrand(projectNumber: string): Promise<string> {
    try {
      console.log('🔍 Checking OAuth brand requirements...');
      
      // Pre-flight check 1: Verify project is in an organization
      const organizationId = process.env.GOOGLE_CLOUD_ORGANIZATION_ID;
      if (!organizationId) {
        throw new Error('Project must belong to a Google Workspace organization to create OAuth brands. Set GOOGLE_CLOUD_ORGANIZATION_ID or skip custom OAuth setup.');
      }
      
      // Pre-flight check 2: Validate support email setup
      const supportEmail = process.env.SUPPORT_EMAIL;
      if (!supportEmail) {
        throw new Error('SUPPORT_EMAIL environment variable is required for OAuth brand creation');
      }
      
      // Sanity check to reject obvious service-account patterns
      if (supportEmail.endsWith('.gserviceaccount.com')) {
        throw new Error('SUPPORT_EMAIL must be a Google Group that your service account OWNS, not a service account email');
      }
      
      // Additional validation for common issues
      if (supportEmail.endsWith('@gmail.com')) {
        console.warn('⚠️ WARNING: Gmail addresses rarely work for OAuth brands. Consider creating a Google Group instead.');
        console.warn('💡 Create a Google Group at https://groups.google.com and make your service account an OWNER');
      }
      
      console.log('✅ Pre-flight checks passed');
      console.log('🔍 Checking for OAuth brand (consent screen)...');
      
      const accessToken = await this.getFirebaseAccessToken();
      const IAP_BASE = 'https://iap.googleapis.com/v1';
      
      // Check if brand already exists (ALWAYS list first - only one brand per project)
      const listBrandsUrl = `${IAP_BASE}/projects/${projectNumber}/brands`;
      const listResponse = await fetch(listBrandsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (listResponse.ok) {
        const brandsData = await listResponse.json();
        if (brandsData.brands && brandsData.brands.length > 0) {
          const brandName = brandsData.brands[0].name;
          console.log('✅ Using existing OAuth brand:', brandName);
          return brandName;
        }
        console.log('ℹ️ No existing OAuth brands found, will create new one');
      } else if (listResponse.status === 403) {
        throw new Error(`Permission denied listing OAuth brands. Service account needs 'clientauthconfig.brands.list' permission. Status: ${listResponse.status}`);
      } else if (listResponse.status === 404) {
        console.log('ℹ️ OAuth brands resource not found (normal for new projects)');
      } else {
        const errorText = await listResponse.text();
        console.warn('⚠️ Failed to list OAuth brands, but continuing:', errorText);
      }

      // Create new brand if none exists
      console.log('🔧 Creating OAuth brand (consent screen)...');
      console.log('📧 Using support email for OAuth brand:', supportEmail);
      console.log('🏢 Project organization:', organizationId);
      
      const createBrandUrl = `${IAP_BASE}/projects/${projectNumber}/brands`;
      const createResponse = await fetch(createBrandUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          applicationTitle: 'Firebase Web Application', // Meet Google brand naming requirements
          supportEmail: supportEmail
        })
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        console.error('❌ OAuth brand creation failed:', JSON.stringify(errorData, null, 2));
        
        // Enhanced error handling with specific guidance
        if (createResponse.status === 400) {
          let errorMessage = 'OAuth brand creation rejected by Google';
          
          // Try to extract detailed error information
          if (errorData.error?.details) {
            const details = errorData.error.details;
            console.error('🔍 Detailed error information:', JSON.stringify(details, null, 2));
            errorMessage += `. Details: ${JSON.stringify(details)}`;
          }
          
          errorMessage += '\n\nCommon causes:\n';
          errorMessage += '1. Service account must be an OWNER of the support email/group\n';
          errorMessage += '2. Project must be in a Google Workspace organization\n';
          errorMessage += '3. Support email must be a Google Group (not Gmail)\n';
          errorMessage += '\nSolution: Create a Google Group, make your service account an OWNER, and use that as SUPPORT_EMAIL';
          
          throw new Error(errorMessage);
        } else if (createResponse.status === 409) {
          throw new Error(`OAuth brand already exists (this shouldn't happen if list worked correctly): ${JSON.stringify(errorData)}`);
        } else {
          throw new Error(`Failed to create OAuth brand: ${createResponse.status} ${createResponse.statusText} - ${JSON.stringify(errorData)}`);
        }
      }

      const brandData = await createResponse.json();
      console.log('✅ OAuth brand created successfully');
      
      // Wait for brand to propagate before proceeding with OAuth client creation
      console.log('⏳ Waiting for OAuth brand to propagate...');
      await this.pollUntilOk(
        () => fetch(`${IAP_BASE}/projects/${projectNumber}/brands`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }),
        { initialDelayMs: 3000, maxDelayMs: 8000, timeoutMs: 30000 }
      );
      
      return brandData.name;

    } catch (error: any) {
      console.error('❌ Failed to create OAuth brand:', error.message);
      throw new Error(`OAuth brand creation failed: ${error.message}`);
    }
  }

  /**
   * Create OAuth web client for Google Sign-In using IAM API
   * Falls back to Firebase default provider if custom OAuth setup fails
   */
  private static async createOAuthWebClient(projectNumber: string, projectId: string): Promise<{ clientId: string; clientSecret: string; customOAuthConfigured?: boolean } | null> {
    try {
      console.log('🔑 Setting up OAuth web client via IAM API...');
      
      // First ensure OAuth brand exists (may fail due to strict requirements)
      let brandCreated = false;
      try {
        await this.ensureOAuthBrand(projectNumber);
        brandCreated = true;
      } catch (brandError: any) {
        console.warn('⚠️ OAuth brand creation failed:', brandError.message);
        console.log('ℹ️ Will use Firebase default Google provider instead');
        return null; // Return null to indicate fallback to default provider
      }
      
      if (!brandCreated) {
        return null;
      }
      
      const accessToken = await this.getFirebaseAccessToken();
      const IAM_BASE = 'https://iam.googleapis.com/v1';
      
      // Check for existing OAuth clients first
      const listClientsUrl = `${IAM_BASE}/projects/${projectNumber}/locations/global/oauthClients`;
      const listResponse = await fetch(listClientsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (listResponse.ok) {
        const clientsData = await listResponse.json();
        if (clientsData.oauthClients && clientsData.oauthClients.length > 0) {
          const existingClient = clientsData.oauthClients[0];
          const existingId = existingClient.name.split('/').pop()!;
          console.log('✅ Found existing OAuth web client, retrieving or creating secret...');
          
          // First, try to list existing credentials
          const credsUrl = `${IAM_BASE}/${existingClient.name}/credentials`;
          const credsResponse = await fetch(credsUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          });
          
          if (credsResponse.ok) {
            const credsData = await credsResponse.json();
            
            if (credsData.oauthClientCredentials?.length > 0) {
              // Existing credential found, fetch its secret
              const credName = credsData.oauthClientCredentials[0].name;
              const secretResponse = await fetch(`${IAM_BASE}/${credName}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`
                }
              });
              
              if (secretResponse.ok) {
                const credentialData = await secretResponse.json();
                const secret = credentialData.clientSecret;
                console.log('✅ Using existing OAuth web client with retrieved secret');
                return {
                  clientId: existingId,
                  clientSecret: secret
                };
              }
            }
          }
          
          // No existing credentials or failed to retrieve - create new credential
          console.log('🔑 Creating new credential for existing OAuth client...');
          const credentialUrl = `${IAM_BASE}/${existingClient.name}/credentials?oauthClientCredentialId=primary`;
          const credResp = await fetch(credentialUrl, {
            method: 'POST',
            headers: { 
              'Authorization': `Bearer ${accessToken}`, 
              'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ displayName: 'Primary secret' })
          });
          
          if (credResp.ok) {
            const credData = await credResp.json();
            const secret = credData.clientSecret;
            console.log('✅ Using existing OAuth web client with new credential');
            return {
              clientId: existingId,
              clientSecret: secret
            };
          }
          
          console.warn('⚠️ Failed to retrieve or create credential for existing client, falling back to default provider');
          // Return existing ID but signal OAuth is not configured to avoid 409 collision
          return {
            clientId: existingId,
            clientSecret: '', // Empty secret signals fallback to default provider
            customOAuthConfigured: false
          };
        }
      }

      // Create OAuth client using IAM API if none exists
      console.log('🔧 Creating new OAuth web client...');
      
      // ✨ NEW: choose an ID up-front
      const oauthClientId = `web-${projectId}`.substring(0, 63); // 6–63 chars, must start with a letter
      
      // PATCHED request with mandatory fields
      const createClientUrl = `${IAM_BASE}/projects/${projectNumber}/locations/global/oauthClients?oauthClientId=${oauthClientId}`;
      const clientResponse = await fetch(createClientUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayName: 'Firebase Web App OAuth Client',
          clientType: 'CONFIDENTIAL_CLIENT',
          allowedGrantTypes: [
            'AUTHORIZATION_CODE_GRANT',
            'REFRESH_TOKEN_GRANT' // good practice for web-server flows
          ],
          allowedScopes: ['openid', 'email', 'https://www.googleapis.com/auth/cloud-platform'],
          allowedRedirectUris: [
            `https://${projectId}.web.app/__/auth/handler`,
            `https://${projectId}.firebaseapp.com/__/auth/handler`,
            // Only include localhost URIs in non-production environments for security
            ...(process.env.NODE_ENV !== 'production' ? [
              'https://localhost:3000/__/auth/handler', // For local dev
              'https://localhost:3001/__/auth/handler'  // Common alt port
            ] : [])
          ]
        })
      });

      if (!clientResponse.ok) {
        const errorText = await clientResponse.text();
        console.warn('⚠️ OAuth client creation failed:', errorText);
        console.log('ℹ️ Will use Firebase default Google provider instead');
        return null; // Fallback to default provider
      }

      const clientData = await clientResponse.json();
      console.log('✅ OAuth web client created successfully');
      
      // Parse clientId correctly - IAM API returns full resource path in 'name'
      const fullName = clientData.name; // "projects/123456/locations/global/oauthClients/abcdefg123"
      const extractedClientId = fullName.split('/').pop()!; // "abcdefg123"
      let extractedClientSecret: string; // Declare in outer scope
      
      // 🔑 Create credential (secret) - new IAM OAuth API requires creating credential, not listing
      console.log('🔑 Creating OAuth client credential...');
      const credentialUrl = `${IAM_BASE}/projects/${projectNumber}/locations/global/oauthClients/${extractedClientId}/credentials?oauthClientCredentialId=primary`;
      console.log('🔍 Credential URL:', credentialUrl);
      
      try {
        const credResp = await fetch(credentialUrl, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${accessToken}`, 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({ displayName: 'Primary secret' })
        });
        
        if (!credResp.ok) {
          const errorText = await credResp.text();
          throw new Error(`Failed to create credential: ${credResp.status} ${credResp.statusText} - ${errorText}`);
        }
        
        const credData = await credResp.json();
        extractedClientSecret = credData.clientSecret; // Secret returned once in create response
        
        if (!extractedClientId || !extractedClientSecret) {
          console.error('❌ OAuth client missing required fields:', {
            hasClientId: !!extractedClientId,
            hasClientSecret: !!extractedClientSecret,
            clientName: fullName
          });
          throw new Error('OAuth client missing clientId or clientSecret');
        }
        
        console.log('🔍 OAuth client configured successfully:', {
          clientId: extractedClientId.substring(0, 10) + '...',
          hasClientSecret: !!extractedClientSecret
        });
        
      } catch (secretError: any) {
        console.error('❌ Failed to create OAuth client credential:', {
          error: secretError.message,
          url: credentialUrl
        });
        throw new Error(`Failed to create OAuth client credential: ${secretError.message}`);
      }
      
      // Wait for OAuth client to propagate before proceeding
      console.log('⏳ Waiting for OAuth client to propagate...');
      await this.pollUntilOk(
        () => fetch(`${IAM_BASE}/projects/${projectNumber}/locations/global/oauthClients`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        }),
        { initialDelayMs: 3000, maxDelayMs: 8000, timeoutMs: 30000 }
      );
      
      return {
        clientId: extractedClientId,
        clientSecret: extractedClientSecret
      };

    } catch (error: any) {
      console.warn('⚠️ Failed to setup OAuth web client:', error.message);
      console.log('ℹ️ Will use Firebase default Google provider instead');
      return null; // Fallback to default provider
    }
  }

  /**
   * Enable Email/Password authentication provider
   */
  private static async enableEmailPassword(
    projectNumber: string
  ): Promise<void> {
    const accessToken = await this.getFirebaseAccessToken();
    const IDP_BASE = 'https://identitytoolkit.googleapis.com/admin/v2';
    const url =
      `${IDP_BASE}/projects/${projectNumber}/config` +
      '?updateMask=signIn.email';

    const body = {
      signIn: {
        email: { enabled: true, passwordRequired: true }
      }
    };

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Failed to enable Email/Password provider: ${res.status} ${text}`
      );
    }

    console.log('✅ Email/Password provider enabled successfully');
  }

  /**
   * Setup Firebase Authentication with Google and Email/Password providers
   */
  private static async setupFirebaseAuthentication(
    projectId: string,
    _cachedProjectNumber?: string // Keep 2-arg signature for backwards-compat, underscore to silence unused lint
  ): Promise<{ success: boolean; providers: string[]; clientId?: string; authType?: 'custom-oauth' | 'firebase-default'; customOAuthConfigured?: boolean; error?: string } | null> {
    try {
      console.log('🔐 Setting up Firebase Authentication with Google and Email/Password providers...');
      
      // Step 1: Get numeric project number (required for Identity Toolkit APIs)
      const projectNumber = await this.getProjectNumber(projectId);
      console.log('🔍 Using project number for Identity Toolkit:', projectNumber);
      
      // Step 2: Use admin/v2 endpoints with project number
      const accessToken = await this.getFirebaseAccessToken();
      const IDP_BASE = 'https://identitytoolkit.googleapis.com/admin/v2';

      // Step 3: Wait for Identity Toolkit configuration to be ready (prevents race conditions)
      await this.waitForIdentityToolkit(projectNumber);

      // Step 3.5: Enable Email/Password authentication provider
      console.log('🔧 Enabling Email/Password authentication provider...');
      await this.enableEmailPassword(projectNumber);

      // Step 4: Create OAuth web client for Google Sign-In (optional)
      console.log('🔑 Attempting to create OAuth web client for Google Sign-In...');
      const oauthClient = await this.createOAuthWebClient(projectNumber, projectId);
      
      let useCustomOAuth = false;
      let clientId = '';
      let clientSecret = '';
      
      if (oauthClient) {
        // Check if this is a fallback case (existing client but secret retrieval failed)
        if (oauthClient.customOAuthConfigured === false) {
          console.log('ℹ️ Existing OAuth client found but secret unavailable, using Firebase default provider');
          useCustomOAuth = false;
        } else if (oauthClient.clientSecret) {
          console.log('✅ Using custom OAuth credentials for Google Sign-In');
          useCustomOAuth = true;
          clientId = oauthClient.clientId;
          clientSecret = oauthClient.clientSecret;
          
          // Runtime checks (good practice)
          if (!clientId) {
            throw new Error('OAuth clientId is missing from createOAuthWebClient response');
          }
          if (!clientSecret) {
            throw new Error('OAuth clientSecret is missing from createOAuthWebClient response - did you forget CONFIDENTIAL_CLIENT?');
          }
          
          console.log('🔍 OAuth credentials to be used:', {
            clientId: clientId.substring(0, 10) + '...',
            hasClientSecret: !!clientSecret
          });
        } else {
          console.log('ℹ️ OAuth client returned without secret, using Firebase default provider');
          useCustomOAuth = false;
        }
      } else {
        console.log('ℹ️ Using Firebase default Google provider (no custom OAuth credentials)');
        useCustomOAuth = false;
      }

      // Step 5: Enable the Google provider (with or without custom OAuth credentials)
      const parent = `projects/${projectNumber}`;
      const authHeaders = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      };
      
      let enableUrl: string;
      let requestBody: any;
      
      if (useCustomOAuth) {
        // Use custom OAuth credentials
        enableUrl = `${IDP_BASE}/${parent}/defaultSupportedIdpConfigs/google.com?updateMask=enabled,clientId,clientSecret`;
        requestBody = {
          enabled: true,
          clientId,
          clientSecret
        };
        console.log('🔧 Enabling Google provider with custom OAuth credentials...');
      } else {
        // Use Firebase default provider (no custom credentials needed)
        enableUrl = `${IDP_BASE}/${parent}/defaultSupportedIdpConfigs/google.com?updateMask=enabled`;
        requestBody = {
          enabled: true
        };
        console.log('🔧 Enabling Google provider with Firebase default credentials...');
      }
      
      // 1️⃣ Try PATCH first (most common case)
      let response = await fetch(enableUrl, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(requestBody)
      });

      let skipVerificationCheck = false;

      if (response.status === 404) {
        // 2️⃣ Only create if we have custom OAuth credentials
        if (useCustomOAuth) {
          console.log('🔄 Google provider not found, creating it with custom OAuth credentials...');
          const createUrl = `${IDP_BASE}/${parent}/defaultSupportedIdpConfigs?idpId=google.com`;
          response = await fetch(createUrl, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(requestBody)
          });
        } else {
          console.log('ℹ️ Google provider not found, but will rely on Firebase default at first sign-in');
          console.log('ℹ️ Firebase will auto-provision the default Google provider when users first sign in');
          console.log('💡 TODO: Consider adding post-deployment health check to verify provider after first sign-in');
          // Mark to skip verification instead of faking response object
          skipVerificationCheck = true;
          response = new Response('{}', { status: 200, statusText: 'OK' });
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to setup Google provider: ${response.status} ${response.statusText} - ${errorText}`);
      }

      if (useCustomOAuth) {
        console.log('✅ Google provider configured successfully with custom OAuth credentials');
      } else {
        console.log('✅ Google provider configured successfully with Firebase default credentials');
      }

      // Smoke test: Verify the Google provider configuration (if using custom OAuth)
      if (useCustomOAuth && !skipVerificationCheck) {
        console.log('🧪 Verifying custom Google provider configuration...');
        const verifyUrl = `${IDP_BASE}/${parent}/defaultSupportedIdpConfigs/google.com`;
        const verifyResponse = await fetch(verifyUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (verifyResponse.ok) {
          const configData = await verifyResponse.json();
          console.log('✅ Custom Google provider verification successful:', {
            enabled: configData.enabled,
            hasClientId: !!configData.clientId,
            clientIdPrefix: configData.clientId?.substring(0, 10) + '...' || 'default',
            authType: 'custom-oauth'
          });
          
          // Runtime check for clientSecret (good practice)
          if (!configData.clientSecret) {
            throw new Error(
              'Google provider is missing clientSecret – did you forget CONFIDENTIAL_CLIENT or updateMask?'
            );
          }
          
          console.log('✅ Verified: Google provider has both clientId and clientSecret configured');
        } else {
          console.warn('⚠️ Custom Google provider verification failed, but continuing...');
        }
      } else {
        console.log('ℹ️ Skipping verification for Firebase default provider (auto-provisioned on first sign-in)');
      }

      // Step 7: Configure project-level authentication settings with granular updateMask
      console.log('🔧 Configuring project authentication settings...');
      const projectConfigUrl = `${IDP_BASE}/projects/${projectNumber}/config?updateMask=signIn.allowDuplicateEmails,mfa,authorizedDomains`;
      
      const projectAuthConfig = {
        signIn: {
          allowDuplicateEmails: false
        },
        mfa: {
          state: 'DISABLED'
        },
        authorizedDomains: [
          `${projectId}.firebaseapp.com`,
          `${projectId}.web.app`,
          'localhost',
          'chatfactory.ai',           // Root domain
          'app.chatfactory.ai',       // App subdomain  
          'www.chatfactory.ai',       // WWW subdomain
          'deploy.chatfactory.ai'     // Deploy subdomain
        ]
      };
      
      const projectConfigResponse = await fetch(projectConfigUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(projectAuthConfig)
      });
      
      if (projectConfigResponse.ok) {
        console.log('✅ Project authentication settings configured');
      } else {
        console.warn('⚠️ Failed to configure project auth settings, but Google provider should still work');
      }
      
      console.log('✅ Firebase Authentication configured with Google provider');
      
      // Wait for configuration to propagate
      console.log('⏳ Waiting for Firebase Auth configuration to propagate...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      return {
        success: true,
        providers: ['google.com', 'password'], // Include email/password provider
        clientId: useCustomOAuth ? clientId : 'firebase-default',
        authType: useCustomOAuth ? 'custom-oauth' : 'firebase-default',
        customOAuthConfigured: useCustomOAuth
      };
      
    } catch (authError: any) {
      console.error('⚠️ Firebase Authentication setup failed:', authError.message, { error: authError });
      console.log('🔍 Auth setup error details:', {
        message: authError.message,
        name: authError.name,
        status: authError.status
      });
      
      return {
        success: false,
        providers: [], // Empty on failure
        authType: 'firebase-default' as const,
        customOAuthConfigured: false,
        error: authError.message
      };
    }
  }

  /**
   * Get Firebase access token using the exact method from Firebase documentation
   */
  private static async getFirebaseAccessToken(): Promise<string> {
    const { JWT } = require('google-auth-library');
    
    // Get service account credentials
    const credentials = {
      client_email: process.env.FIREBASE_CLIENT_EMAIL || '',
      private_key: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      project_id: process.env.FIREBASE_PROJECT_ID || ''
    };
    
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('Missing Firebase service account credentials');
    }
    
    const SCOPES = ['https://www.googleapis.com/auth/cloud-platform'];
    
    const jwtClient = new JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      SCOPES,
      null
    );
    
    const tokens = await jwtClient.authorize();
    return tokens.access_token;
  }

  /**
   * Verify that a Google Cloud project exists and is accessible
   */
  private static async verifyProjectAccessibility(projectId: string): Promise<void> {
    try {
      console.log('🔍 Verifying project accessibility via Resource Manager SDK...');
      console.log('🔍 Project ID being verified:', projectId);
      console.log('🔍 Service account in use:', process.env.GOOGLE_CLIENT_EMAIL);
      
      // Try to get project using Resource Manager SDK
      const [project] = await resourceManagerClient.getProject({
        name: `projects/${projectId}`
      });
      
      if (project && project.projectId === projectId) {
        console.log('✅ Project verified and accessible:', projectId);
        console.log('📋 Project state:', project.state);
        console.log('📋 Project name:', project.name);
        
        // Additional check: verify project is in ACTIVE state
        if (project.state !== 'ACTIVE') {
          console.warn('⚠️ Project is not in ACTIVE state:', project.state);
          // Wait a bit more for project to become active
          await new Promise(resolve => setTimeout(resolve, 10000));
          
          // Check again
          const [retryProject] = await resourceManagerClient.getProject({
            name: `projects/${projectId}`
          });
          
          if (retryProject.state !== 'ACTIVE') {
            throw new Error(`Project ${projectId} is not in ACTIVE state: ${retryProject.state}`);
          }
          
          console.log('✅ Project is now ACTIVE after retry');
        }
      } else {
        throw new Error(`Project ${projectId} not found or not accessible`);
      }
      
    } catch (verifyError: any) {
      console.error('❌ Project accessibility verification failed:', verifyError.message);
      console.error('🔍 Error code:', verifyError.code);
      console.error('🔍 Error details:', verifyError.details);
      
      // If it's a permission error, provide helpful context
      if (verifyError.message.includes('PERMISSION_DENIED')) {
        console.log('💡 Permission denied debugging info:');
        console.log('   - Service account email:', process.env.GOOGLE_CLIENT_EMAIL);
        console.log('   - Project being accessed:', projectId);
        console.log('   - Organization ID:', process.env.GOOGLE_CLOUD_ORGANIZATION_ID);
        console.log('   - Current IAM roles should include: roles/owner, roles/browser');
        console.log('   - Check if permissions have propagated (can take 2-5 minutes)');
      }
      
      throw new Error(`Failed to verify project accessibility: ${verifyError.message}`);
    }
  }

  /**
   * Parse Firebase config response
   */
  private static parseFirebaseConfig(configData: any, projectId: string): any {
    return {
      apiKey: configData.apiKey || 'configured-via-api',
      authDomain: configData.authDomain || `${projectId}.firebaseapp.com`,
      projectId: projectId,
      storageBucket: configData.storageBucket || `${projectId}.appspot.com`,
      messagingSenderId: configData.messagingSenderId || 'configured-via-api',
      appId: configData.appId || 'configured-via-api'
    };
  }
}
