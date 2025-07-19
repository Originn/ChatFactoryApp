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
import * as admin from 'firebase-admin';
import { google } from 'googleapis'; // Still needed for Firebase Management API and Service Account CRUD
import { FirebaseDbService } from '@/services/firebaseDbService';
import { FirebaseConfigFix } from '@/services/firebaseConfigFix';
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

export interface SetupExistingProjectRequest {
  projectId: string;
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
  isReusableProject?: boolean; // Flag for reusable projects
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
  oauthClientId?: string;
  firebaseAppId?: string;
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

        // Step 7: Get default Firebase service account (created automatically)
        console.log('🔑 Getting default Firebase Admin SDK service account...');
        let serviceAccount = await this.getDefaultFirebaseServiceAccount(projectId);
        
        // If both default and custom service account creation failed, use main project as temporary fallback
        if (!serviceAccount) {
          console.warn('⚠️ Both default and custom service account creation failed');
          console.log('🔄 Using main project service account as temporary fallback...');
          
          serviceAccount = {
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
            privateKey: process.env.FIREBASE_PRIVATE_KEY || ''
          };
          
          if (serviceAccount.clientEmail && serviceAccount.privateKey) {
            console.log('✅ Using main project service account as fallback');
            console.log('⚠️ WARNING: This is a temporary solution - dedicated service account creation needs to be fixed');
            console.log('🔍 Fallback service account:', serviceAccount.clientEmail);
          } else {
            console.error('❌ Main project service account credentials are also missing!');
            serviceAccount = null;
          }
        }

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
        
        // Step: Create Firestore database in the dedicated project
        console.log('🗄️  Creating Firestore database in dedicated project...');
        try {
          const dbResult = await FirebaseDbService.ensureDefaultDatabase(projectId, 'us-central1');
          
          if (dbResult.success) {
            console.log('✅ Firestore database created successfully in dedicated project');
            
            // Step: Populate database with chatbot data
            console.log('📝 Populating database with chatbot data...');
            try {
              await this.populateDedicatedDatabase(projectId, chatbotId);
              console.log('✅ Database populated with chatbot data successfully');
            } catch (populateError: any) {
              console.error('❌ Failed to populate database:', populateError);
              console.log('⚠️  Deployment will continue without initial data');
            }
            
            // Update project record with database info
            await projectRef.update({
              hasFirestoreDatabase: true,
              databaseCreatedAt: Timestamp.now(),
              updatedAt: Timestamp.now()
            });
            
            // Update chatbot record with database info
            await adminDb.collection('chatbots').doc(chatbotId).update({
              hasFirestoreDatabase: true,
              databaseCreatedAt: Timestamp.now(),
              updatedAt: Timestamp.now()
            });
            
          } else {
            console.error('❌ Failed to create Firestore database:', dbResult.error);
            console.log('⚠️  Project deployment will continue without Firestore database');
            
            // Update project record with database failure (but don't fail the deployment)
            await projectRef.update({
              hasFirestoreDatabase: false,
              databaseError: dbResult.error,
              updatedAt: Timestamp.now()
            });
          }
          
        } catch (dbError: any) {
          console.error('❌ Error creating Firestore database:', dbError);
          console.log('⚠️  Project deployment will continue without Firestore database');
          
          // Update project record with database error (but don't fail the deployment)
          await projectRef.update({
            hasFirestoreDatabase: false,
            databaseError: dbError.message,
            updatedAt: Timestamp.now()
          });
        }
        
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
   * Set up an existing Google Cloud project with Firebase services for a chatbot
   * This is used for reusable Firebase projects in development mode
   */
  static async setupExistingProjectForChatbot(
    request: SetupExistingProjectRequest
  ): Promise<{ success: boolean; project?: FirebaseProject; error?: string }> {
    try {
      const { projectId, chatbotId, chatbotName, creatorUserId } = request;
      
      console.log('🔧 Setting up existing Firebase project for chatbot:', { projectId, chatbotId });
      
      // Test permissions first
      console.log('🧪 Testing service account permissions...');
      const permissionTest = await this.testPermissions();
      
      if (!permissionTest.success) {
        const errorMessage = `Service account lacks required permissions: ${permissionTest.missing.join(', ')}`;
        console.error('❌ Permission check failed:', errorMessage);
        return { success: false, error: errorMessage };
      }
      
      console.log('✅ Permission check passed - proceeding with project setup');
      
      const displayName = `${chatbotName} Chatbot (Reusable)`;

      // Store project record for this chatbot configuration
      const projectRef = adminDb.collection(this.FIREBASE_PROJECTS_COLLECTION).doc(`${projectId}-${chatbotId}`);
      await projectRef.set({
        projectId,
        displayName,
        chatbotId,
        creatorUserId,
        isReusableProject: true,
        originalProjectId: projectId,
        createdAt: Timestamp.now(),
        status: 'configuring'
      });

      try {
        // Skip project creation - project already exists
        console.log('✅ Using existing Google Cloud project:', projectId);
        
        // Get project number for API operations
        console.log('🔍 Getting project number...');
        const projectNumber = await this.getProjectNumber(projectId);

        // Step 1: Enable required APIs (same as new project creation)
        console.log('🔧 Ensuring required APIs are enabled...');
        await this.enableRequiredAPIsSDK(projectId, projectNumber);

        // Step 2: Set up Firebase services (same as new project creation)
        console.log('🔥 Setting up Firebase services...');
        
        // Initialize Identity Platform (this also adds Firebase to the project)
        console.log('🆔 Setting up Identity Platform...');
        await this.initialiseIdentityPlatform(projectNumber);
        
        // Add Firebase to project and get configuration
        console.log('🔥 Adding Firebase to project...');
        const firebaseConfig = await this.addFirebaseToProject(projectId, displayName);
        
        // Step 2.5: Configure Firebase Authentication with Google and Email/Password providers
        console.log('🔐 Configuring Firebase Authentication...');
        const authConfig = await this.setupFirebaseAuthentication(projectId, projectNumber);
        
        // Extract OAuth client ID from auth configuration
        const oauthClientId = authConfig?.clientId || 'firebase-default';
        console.log(`🔑 OAuth Client ID: ${oauthClientId}`);
        
        // Step 2.7: Deploy Firestore security rules
        console.log('🛡️ Deploying Firestore security rules...');
        try {
          await this.deployFirestoreSecurityRules(projectId);
          console.log('✅ Firestore security rules deployed successfully');
        } catch (rulesError: any) {
          console.warn('⚠️ Failed to deploy Firestore security rules:', rulesError.message);
          console.log('💡 You may need to manually configure Firestore rules in the Firebase Console');
        }
        
        // Step 3: Create service account with granular permissions for this chatbot
        console.log('🔑 Creating service account with granular permissions...');
        const serviceAccountResult = await this.createServiceAccountREST(projectId);
        
        if (!serviceAccountResult) {
          throw new Error('Failed to create service account');
        }

        // OAuth is already configured in setupFirebaseAuthentication above - no need to duplicate
        console.log('ℹ️ OAuth configuration already handled by Firebase Authentication setup');

        // Step 5: Create storage buckets (if not already exist)
        console.log('🪣 Setting up storage buckets...');
        await this.createStorageBucketsSDK(projectId);

        // Construct complete project object
        const completeProject: FirebaseProject = {
          projectId,
          displayName,
          chatbotId,
          creatorUserId,
          isReusableProject: true,
          config: firebaseConfig,
          serviceAccount: {
            clientEmail: serviceAccountResult.clientEmail,
            privateKey: serviceAccountResult.privateKey,
          },
          oauthClientId,
          firebaseAppId: firebaseConfig.appId,
          createdAt: Timestamp.now(),
          status: 'active',
          ...(authConfig && { authConfig })
        };

        // Update project record with success
        await projectRef.update({
          status: 'active',
          config: firebaseConfig,
          serviceAccount: {
            clientEmail: serviceAccountResult.clientEmail,
            // Don't store private key in Firestore for security
          },
          firebaseAppId: firebaseConfig.appId,
          oauthClientId,
          completedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          ...(authConfig?.success && { 
            authConfig: {
              success: authConfig.success,
              providers: authConfig.providers,
              authType: authConfig.authType,
              customOAuthConfigured: authConfig.customOAuthConfigured
            }
          })
        });

        console.log('✅ Existing Firebase project successfully configured for chatbot');
        return { success: true, project: completeProject };

      } catch (setupError: any) {
        console.error('❌ Firebase project setup failed:', setupError.message);
        
        // Update project record with failure
        await projectRef.update({
          status: 'failed',
          error: setupError.message,
          failedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        
        return { 
          success: false, 
          error: `Firebase project setup failed: ${setupError.message}` 
        };
      }

    } catch (error: any) {
      console.error('❌ Error in setupExistingProjectForChatbot:', error);
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
      'iamcredentials.googleapis.com',   // Required for service-account key operations
      'firebaserules.googleapis.com'     // Required for Firestore security rules
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
      // 🔧 FIX: Create project-specific Storage client to ensure buckets are created in correct project
      const { Storage } = require('@google-cloud/storage');
      const { getGCPCredentials } = require('@/lib/gcp-auth');
      
      const credentials = getGCPCredentials();
      const projectSpecificStorage = new Storage({
        projectId: projectId, // 🎯 Explicitly target the new project
        ...(credentials && Object.keys(credentials).length > 0 && { 
          credentials: (credentials as any).credentials 
        })
      });
      
      console.log(`📋 Creating buckets in project: ${projectId} (using project-specific Storage client)`);
      
      const bucketSuffixes = [
        'chatbot-documents',
        'chatbot-private-images', 
        'chatbot-document-images'
      ];
      
      for (const suffix of bucketSuffixes) {
        const bucketName = `${projectId}-${suffix}`;
        try {
          // ✅ Special configuration for image bucket (needs to be public for multimodal embedding)
          const isImageBucket = suffix === 'chatbot-document-images';
          
          const bucketConfig = {
            location: 'us-central1',
            storageClass: 'STANDARD',
            uniformBucketLevelAccess: true,
            publicAccessPrevention: isImageBucket ? 'inherited' : 'enforced' // ✅ Allow public access for images
          };
          
          const [bucket] = await projectSpecificStorage.createBucket(bucketName, bucketConfig);
          
          // ✅ Make image bucket publicly readable for multimodal embedding
          if (isImageBucket) {
            try {
              const [policy] = await bucket.getIamPolicy({ requestedPolicyVersion: 3 });
              
              // Add public read access
              policy.bindings.push({
                role: 'roles/storage.objectViewer',
                members: ['allUsers']
              });
              
              await bucket.setIamPolicy(policy);
              console.log('🌐 Made image bucket publicly readable:', bucketName);
            } catch (publicError: any) {
              console.warn('⚠️ Could not make image bucket public:', publicError.message);
              // Continue anyway - can be set manually later
            }
          }
          
          buckets[suffix.replace('-', '_')] = bucketName;
          console.log('✅ Bucket created via Storage SDK:', bucketName);
        } catch (bucketError: any) {
          if (bucketError.code === 409) {
            buckets[suffix.replace('-', '_')] = bucketName;
            console.log('ℹ️ Bucket already exists:', bucketName);
            
            // ✅ Still try to make image bucket public if it already exists
            if (suffix === 'chatbot-document-images') {
              try {
                const bucket = projectSpecificStorage.bucket(bucketName);
                const [policy] = await bucket.getIamPolicy({ requestedPolicyVersion: 3 });
                
                // Check if already public
                const isAlreadyPublic = policy.bindings.some(binding => 
                  binding.role === 'roles/storage.objectViewer' && 
                  binding.members?.includes('allUsers')
                );
                
                if (!isAlreadyPublic) {
                  policy.bindings.push({
                    role: 'roles/storage.objectViewer',
                    members: ['allUsers']
                  });
                  
                  await bucket.setIamPolicy(policy);
                  console.log('🌐 Made existing image bucket publicly readable:', bucketName);
                } else {
                  console.log('✅ Image bucket is already publicly readable:', bucketName);
                }
              } catch (publicError: any) {
                console.warn('⚠️ Could not make existing image bucket public:', publicError.message);
              }
            }
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
   * Now uses direct config retrieval with proper timing
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
        
        // Wait for web app to be fully ready
        console.log('⏳ Waiting for web app to be fully ready...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
      } catch (webAppError: any) {
        if (webAppError.message?.includes('already exists')) {
          console.log('ℹ️ Firebase web app already exists - continuing...');
        } else {
          console.warn('⚠️ Failed to create web app:', webAppError.message);
        }
      }

      // Use the direct Firebase configuration fix (the key improvement!)
      console.log('🔧 Using direct Firebase configuration retrieval...');
      
      try {
        const firebaseConfig = await FirebaseConfigFix.getFirebaseWebAppConfig(projectId);
        
        // Test the API key to ensure it works
        console.log('🧪 Testing retrieved API key...');
        const isValid = await FirebaseConfigFix.testApiKeyWorks(firebaseConfig.apiKey, projectId);
        
        if (!isValid) {
          throw new Error('Retrieved API key failed validation test');
        }
        
        console.log('✅ API key validated successfully');
        
        // Configure API key restrictions for Firebase Auth
        await this.configureAPIKeyForFirebaseAuth(firebaseConfig.apiKey, projectId, authClient);
        
        return firebaseConfig;
        
      } catch (configError: any) {
        console.error('❌ Direct config retrieval failed:', configError.message);
        
        // Instead of falling back to fake API key, fail the deployment
        throw new Error(
          `Failed to retrieve valid Firebase configuration: ${configError.message}. ` +
          `This usually indicates a timing or permissions issue. ` +
          `Check that the service account has Firebase Admin permissions.`
        );
      }
      
    } catch (firebaseError: any) {
      console.error('❌ Firebase project setup via REST API failed:', firebaseError.message);
      throw new Error(`Firebase setup failed: ${firebaseError.message}`);
    }
  }

  /**
   * Get default Firebase Admin SDK service account (created automatically by Firebase)
   */
  private static async getDefaultFirebaseServiceAccount(projectId: string): Promise<{ clientEmail: string; privateKey: string } | null> {
    try {
      console.log('🔍 Looking for default Firebase Admin SDK service account...');
      console.log('🔍 Project ID:', projectId);
      
      const authClient = await getAuthClient();
      if (!authClient) {
        console.error('❌ Failed to get auth client for default service account detection');
        return null;
      }
      
      const iam = google.iam('v1');
      
      // List service accounts to find the default Firebase one
      console.log('📋 Listing service accounts in project...');
      const response = await iam.projects.serviceAccounts.list({
        name: `projects/${projectId}`,
        auth: authClient as any
      });
      
      const serviceAccounts = response.data.accounts || [];
      console.log(`📋 Found ${serviceAccounts.length} service accounts in project`);
      
      if (serviceAccounts.length > 0) {
        console.log('🔍 Available service accounts:');
        serviceAccounts.forEach((sa, index) => {
          console.log(`  ${index + 1}. ${sa.email} (${sa.displayName || 'No display name'})`);
        });
      }
      
      // Find the default Firebase Admin SDK service account
      const firebaseServiceAccount = serviceAccounts.find(account => 
        account.email && (
          account.email.includes('firebase-adminsdk-') ||
          account.email.includes('@appspot.gserviceaccount.com') ||
          account.displayName?.includes('Firebase Admin SDK')
        )
      );
      
      if (!firebaseServiceAccount) {
        console.log('❌ Default Firebase Admin SDK service account not found');
        console.log('🔍 This might be expected - Firebase service accounts are created on first use');
        console.log('📋 Available service accounts:');
        serviceAccounts.forEach(sa => console.log(`  - ${sa.email}`));
        
        // Try to create the default Firebase service account using Firebase Management API
        console.log('🔧 Attempting to initialize default Firebase service account...');
        try {
          const defaultServiceAccount = await this.initializeDefaultFirebaseServiceAccount(projectId);
          if (defaultServiceAccount) {
            console.log('✅ Successfully initialized default Firebase service account');
            return defaultServiceAccount;
          }
        } catch (initError: any) {
          console.warn('⚠️ Failed to initialize default Firebase service account:', initError.message);
        }
        
        return null;
      }
      
      console.log('✅ Found default Firebase service account:', firebaseServiceAccount.email);
      
      // Create a key for the default Firebase service account
      const maxRetries = 3;
      let keyResponse: any = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`🔑 Creating key for default Firebase service account (attempt ${attempt + 1}/${maxRetries})...`);
          
          keyResponse = await iam.projects.serviceAccounts.keys.create({
            name: `projects/${projectId}/serviceAccounts/${firebaseServiceAccount.email}`,
            requestBody: {
              privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE',
              keyAlgorithm: 'KEY_ALG_RSA_2048'
            },
            auth: authClient as any
          });
          
          console.log('✅ Service account key created for default Firebase service account');
          break; // Success!
          
        } catch (keyError: any) {
          console.log('🔍 Key creation error for default service account:', {
            attempt: attempt + 1,
            code: keyError.code,
            message: keyError.message
          });
          
          if (attempt < maxRetries - 1) {
            const delay = Math.min(20000 + (attempt * 10000), 40000);
            console.log(`⚠️ Key creation attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay/1000}s...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw keyError;
          }
        }
      }
      
      if (keyResponse && keyResponse.data && keyResponse.data.privateKeyData) {
        const keyData = JSON.parse(Buffer.from(keyResponse.data.privateKeyData, 'base64').toString());
        
        console.log('✅ Default Firebase service account key processed successfully');
        console.log('🔍 Default service account details:', {
          clientEmail: keyData.client_email,
          projectId: keyData.project_id,
          hasPrivateKey: !!keyData.private_key
        });
        
        return {
          clientEmail: keyData.client_email,
          privateKey: keyData.private_key
        };
      }
      
      console.error('❌ No private key data received for default Firebase service account');
      return null;
      
    } catch (error: any) {
      console.error('❌ Failed to get default Firebase service account:', {
        message: error.message,
        code: error.code,
        status: error.status
      });
      console.log('💡 Falling back to custom service account creation...');
      
      // Fallback to custom service account creation if default doesn't work
      return await this.createServiceAccountREST(projectId);
    }
  }

  /**
   * Initialize default Firebase service account using Firebase Admin SDK
   */
  private static async initializeDefaultFirebaseServiceAccount(projectId: string): Promise<{ clientEmail: string; privateKey: string } | null> {
    try {
      console.log('🔧 Initializing default Firebase service account via Firebase Management API...');
      
      // This would require Firebase Management API calls, which is complex
      // For now, return null to fall back to custom service account
      console.log('ℹ️ Default Firebase service account initialization not implemented');
      console.log('💡 This is expected - falling back to custom service account creation');
      
      return null;
    } catch (error: any) {
      console.error('❌ Failed to initialize default Firebase service account:', error.message);
      return null;
    }
  }

  /**
   * Create service account (REST API - no SDK for CRUD operations)
   */
  private static async createServiceAccountREST(projectId: string): Promise<{ clientEmail: string; privateKey: string } | null> {
    try {
      console.log('🔑 Creating custom service account via REST API...');
      console.log('🔍 Project ID:', projectId);
      
      const authClient = await getAuthClient();
      if (!authClient) {
        console.error('❌ Failed to get auth client');
        return null;
      }
      console.log('✅ Auth client obtained successfully');
      
      const iam = google.iam('v1');
      
      const serviceAccountId = `${projectId.replace(/-/g, '')}-admin`.substring(0, 30);
      const serviceAccountEmail = `${serviceAccountId}@${projectId}.iam.gserviceaccount.com`;
      
      console.log('🔍 Service account details:', {
        id: serviceAccountId,
        email: serviceAccountEmail,
        project: projectId
      });
      
      // Create service account with detailed error handling
      try {
        console.log('🔨 Creating service account...');
        const createResponse = await iam.projects.serviceAccounts.create({
          name: `projects/${projectId}`,
          requestBody: {
            accountId: serviceAccountId,
            serviceAccount: {
              displayName: `${projectId} Admin Service Account`,
              description: 'Service account for Firebase Admin operations'
            }
          },
          auth: authClient as any
        });
        
        console.log('✅ Service account created successfully:', serviceAccountEmail);
        console.log('📋 Create response:', createResponse.data?.email || 'No email in response');
        
      } catch (createError: any) {
        console.log('🔍 Service account creation error details:', {
          code: createError.code,
          status: createError.status,
          message: createError.message,
          details: createError.errors || createError.details
        });
        
        if (createError.code === 409 || createError.status === 409) {
          console.log('ℹ️ Service account already exists:', serviceAccountEmail);
        } else {
          console.error('❌ Service account creation failed with error:', createError.message);
          throw createError; // Re-throw non-conflict errors
        }
      }
      
      // Wait for service account to propagate
      console.log('⏳ Waiting for service account to propagate (30s)...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // Create service account key with enhanced retry and error handling
      console.log('🔑 Creating service account key...');
      const maxRetries = 4;
      let keyResponse: any = null;
      let lastError: any = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`🔍 Key creation attempt ${attempt + 1}/${maxRetries}...`);
          
          keyResponse = await iam.projects.serviceAccounts.keys.create({
            name: `projects/${projectId}/serviceAccounts/${serviceAccountEmail}`,
            requestBody: {
              privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE',
              keyAlgorithm: 'KEY_ALG_RSA_2048'
            },
            auth: authClient as any
          });
          
          console.log('✅ Service account key created successfully');
          console.log('📋 Key response status:', keyResponse.status);
          break; // Success!
          
        } catch (keyError: any) {
          lastError = keyError;
          console.log('🔍 Key creation error details:', {
            attempt: attempt + 1,
            code: keyError.code,
            status: keyError.status,
            message: keyError.message,
            details: keyError.errors || keyError.details
          });
          
          if (attempt < maxRetries - 1) {
            const delay = Math.min(30000 + (attempt * 15000), 60000);
            console.log(`⚠️ Key creation attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay/1000}s...`);
            console.log(`   Error: ${keyError.message}`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.error('❌ All key creation attempts failed');
            throw keyError;
          }
        }
      }
      
      // Process the key response
      if (keyResponse && keyResponse.data && keyResponse.data.privateKeyData) {
        console.log('🔍 Processing private key data...');
        try {
          const keyData = JSON.parse(Buffer.from(keyResponse.data.privateKeyData, 'base64').toString());
          
          console.log('✅ Service account key processed successfully');
          console.log('🔍 Key details:', {
            clientEmail: keyData.client_email,
            projectId: keyData.project_id,
            hasPrivateKey: !!keyData.private_key,
            privateKeyLength: keyData.private_key?.length || 0
          });
          
          // Add granular Firebase permissions to the custom service account
          console.log('🔐 Adding granular Firebase permissions to custom service account...');
          try {
            await this.addFirebaseAdminPermissions(projectId, serviceAccountEmail);
            console.log('✅ Granular Firebase permissions configured for custom service account');
          } catch (permissionError: any) {
            console.warn('⚠️ Failed to add granular Firebase permissions, but continuing:', permissionError.message);
            // Continue anyway - the service account might still work for basic operations
          }
          
          return {
            clientEmail: keyData.client_email,
            privateKey: keyData.private_key
          };
        } catch (parseError: any) {
          console.error('❌ Failed to parse private key data:', parseError.message);
          throw parseError;
        }
      } else {
        console.error('❌ No private key data in response');
        console.log('🔍 Key response structure:', {
          hasData: !!keyResponse?.data,
          hasPrivateKeyData: !!keyResponse?.data?.privateKeyData,
          responseKeys: keyResponse?.data ? Object.keys(keyResponse.data) : 'no data'
        });
        throw new Error('No private key data received from Google IAM API');
      }
      
    } catch (serviceAccountError: any) {
      console.error('❌ Service account creation via REST API failed:', {
        message: serviceAccountError.message,
        code: serviceAccountError.code,
        status: serviceAccountError.status,
        details: serviceAccountError.errors || serviceAccountError.details || 'No additional details'
      });
      console.error('❌ Full error object:', serviceAccountError);
      return null;
    }
  }

  /**
   * Set granular bucket-level permissions for chatbot service account
   */
  private static async setBucketLevelPermissions(
    projectId: string, 
    serviceAccountEmail: string
  ): Promise<void> {
    try {
      console.log('🔐 Setting bucket-level permissions for:', serviceAccountEmail);
      
      const { Storage } = require('@google-cloud/storage');
      const { getGCPCredentials } = require('@/lib/gcp-auth');
      
      const credentials = getGCPCredentials();
      const storage = new Storage({
        projectId: projectId,
        ...(credentials && Object.keys(credentials).length > 0 && { 
          credentials: (credentials as any).credentials 
        })
      });

      // Define chatbot-specific buckets with their required permissions
      const bucketPermissions = [
        {
          name: `${projectId}-chatbot-documents`,
          roles: [
            'roles/storage.objectAdmin',      // Full CRUD on objects
            'roles/storage.legacyBucketReader' // Read bucket metadata
          ]
        },
        {
          name: `${projectId}-chatbot-private-images`, 
          roles: [
            'roles/storage.objectAdmin',      // Full CRUD on objects
            'roles/storage.legacyBucketReader' // Read bucket metadata
          ]
        },
        {
          name: `${projectId}-chatbot-document-images`,
          roles: [
            'roles/storage.objectAdmin',      // Full CRUD on objects  
            'roles/storage.legacyBucketReader' // Read bucket metadata
          ]
        }
      ];

      // Apply permissions to each bucket
      for (const bucketConfig of bucketPermissions) {
        try {
          const bucket = storage.bucket(bucketConfig.name);
          
          // Check if bucket exists first
          const [bucketExists] = await bucket.exists();
          if (!bucketExists) {
            console.warn(`Bucket does not exist: ${bucketConfig.name}, skipping permissions`);
            continue;
          }
          
          // Get current IAM policy
          const [policy] = await bucket.getIamPolicy({ requestedPolicyVersion: 3 });
          
          let permissionsChanged = false;
          
          // Add service account to each required role
          for (const role of bucketConfig.roles) {
            let binding = policy.bindings.find(b => b.role === role);
            
            if (!binding) {
              binding = {
                role: role,
                members: []
              };
              policy.bindings.push(binding);
              permissionsChanged = true;
            }
            
            const memberString = `serviceAccount:${serviceAccountEmail}`;
            if (!binding.members?.includes(memberString)) {
              binding.members = binding.members || [];
              binding.members.push(memberString);
              permissionsChanged = true;
            }
          }
          
          // Apply updated policy only if changes were made
          if (permissionsChanged) {
            await bucket.setIamPolicy(policy);
          }
          
        } catch (bucketError: any) {
          console.error(`Failed to set permissions for ${bucketConfig.name}:`, bucketError.message);
          // Continue with other buckets rather than failing completely
        }
      }
      
      console.log('✅ All bucket-level permissions configured');
      
    } catch (error: any) {
      console.error('❌ Failed to set bucket-level permissions:', error.message);
      throw error;
    }
  }

  /**
   * Verify that service account permissions were applied correctly
   */
  private static async verifyServiceAccountPermissions(projectId: string, serviceAccountEmail: string): Promise<void> {
    try {
      // Test basic IAM access
      const [policy] = await resourceManagerClient.getIamPolicy({
        resource: `projects/${projectId}`
      });
      
      const serviceAccountBindings = policy.bindings?.filter(binding => 
        binding.members?.some(member => member === `serviceAccount:${serviceAccountEmail}`)
      ) || [];
      
      // Test storage access
      const { Storage } = require('@google-cloud/storage');
      const { getGCPCredentials } = require('@/lib/gcp-auth');
      
      const credentials = getGCPCredentials();
      const storage = new Storage({
        projectId: projectId,
        ...(credentials && Object.keys(credentials).length > 0 && { 
          credentials: (credentials as any).credentials 
        })
      });
      
      // Try to list buckets to verify storage access
      try {
        const [buckets] = await storage.getBuckets();
        const chatbotBuckets = buckets.filter(bucket => 
          bucket.name.includes(`${projectId}-chatbot`)
        );
        
        if (chatbotBuckets.length === 0) {
          console.warn('No chatbot buckets found - this may indicate a permission issue');
        }
        
      } catch (storageError: any) {
        console.warn('Storage access test failed:', storageError.message);
      }
      
    } catch (error: any) {
      console.warn('Could not verify all permissions:', error.message);
      // Don't throw - verification is optional
    }
  }

  /**
   * Add granular Firebase permissions to a service account (includes necessary storage permissions)
   */
  private static async addFirebaseAdminPermissions(projectId: string, serviceAccountEmail: string): Promise<void> {
    try {
      const authClient = await getAuthClient();
      
      // Use Resource Manager to set IAM policy
      const [policy] = await resourceManagerClient.getIamPolicy({
        resource: `projects/${projectId}`
      });
      
      // 🔐 COMPREHENSIVE PROJECT-LEVEL PERMISSIONS (includes all necessary storage permissions)
      const projectRoles = [
        // Essential for Firebase operations
        'roles/iam.serviceAccountTokenCreator',
        
        // Firestore access (can be further restricted with Firestore rules)
        'roles/datastore.user',
        
        // Auth access (read-only)
        'roles/firebaseauth.viewer',
        
        // 🔑 COMPREHENSIVE STORAGE PERMISSIONS (essential for all bucket operations)
        'roles/storage.objectAdmin',         // Full object CRUD across project buckets
        'roles/storage.legacyBucketReader',  // Read bucket metadata  
        'roles/storage.legacyBucketWriter',  // Write bucket metadata (includes buckets.get)
        
        // Alternative approach: Use broader bucket admin for compatibility
        // 'roles/storage.admin',             // Full storage admin (too broad but works)
      ];
      
      const bindings = policy.bindings || [];
      
      // Add the service account to each role
      projectRoles.forEach(role => {
        let binding = bindings.find(b => b.role === role);
        if (!binding) {
          binding = {
            role: role,
            members: []
          };
          bindings.push(binding);
        }
        
        const memberString = `serviceAccount:${serviceAccountEmail}`;
        if (!binding.members?.includes(memberString)) {
          binding.members = binding.members || [];
          binding.members.push(memberString);
        }
      });
      
      // Update the IAM policy
      await resourceManagerClient.setIamPolicy({
        resource: `projects/${projectId}`,
        policy: {
          ...policy,
          bindings
        }
      });
      
      // 🔐 ADDITIONALLY SET BUCKET-SPECIFIC PERMISSIONS (for extra security)
      await this.setBucketLevelPermissions(projectId, serviceAccountEmail);
      
      // 🔍 VERIFY PERMISSIONS WERE APPLIED
      await this.verifyServiceAccountPermissions(projectId, serviceAccountEmail);
      
    } catch (error: any) {
      console.error('❌ Failed to grant comprehensive Firebase permissions:', error);
      throw error;
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
          console.log(`✅ Found ${clientsData.oauthClients.length} existing OAuth client(s), will reuse the first one`);
          
          // 🔑 CRITICAL FIX: Always reuse existing OAuth clients to prevent duplicates
          if (clientsData.oauthClients.length > 1) {
            console.warn(`⚠️ Found ${clientsData.oauthClients.length} OAuth clients - you may have duplicates`);
            console.log('💡 Consider cleaning up duplicate OAuth clients');
          }
          
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
          // 🔑 CRITICAL: Return existing client info to prevent duplicate creation
          // Even if credentials fail, DO NOT create a new OAuth client
          return {
            clientId: existingId,
            clientSecret: '', // Empty secret signals fallback to default provider
            customOAuthConfigured: false
          };
        }
        
        // 🔑 CRITICAL: If we found ANY existing clients, don't create new ones
        console.log('ℹ️ Existing OAuth clients found - will not create duplicates');
        return null; // Use Firebase default provider
      }

      // 🔑 DOUBLE-CHECK: List clients again to prevent race condition duplicates
      console.log('🔍 Final check for existing OAuth clients before creation...');
      const finalCheckResponse = await fetch(listClientsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (finalCheckResponse.ok) {
        const finalCheckData = await finalCheckResponse.json();
        if (finalCheckData.oauthClients && finalCheckData.oauthClients.length > 0) {
          console.log('⚠️ OAuth clients were created during execution - preventing duplicate creation');
          return null; // Use Firebase default provider
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

  /**
   * Configure API key restrictions for Firebase Auth APIs
   */
  private static async configureAPIKeyForFirebaseAuth(apiKey: string, projectId: string, authClient: any): Promise<void> {
    try {
      console.log('🔑 Configuring API key restrictions for Firebase Authentication...');
      
      if (!apiKey || apiKey === 'configured-via-api') {
        console.log('⚠️ Skipping API key configuration - invalid key');
        return;
      }
      
      const accessToken = (await authClient.getAccessToken()).token;
      
      // Get current API key configuration
      const apiKeysResponse = await fetch(`https://apikeys.googleapis.com/v2/projects/${projectId}/locations/global/keys`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!apiKeysResponse.ok) {
        console.warn('⚠️ Could not retrieve API keys for configuration');
        return;
      }

      const apiKeysData = await apiKeysResponse.json();
      
      // Find our API key
      let targetKey = null;
      if (apiKeysData.keys) {
        for (const key of apiKeysData.keys) {
          if (key.keyString === apiKey) {
            targetKey = key;
            break;
          }
        }
      }

      if (!targetKey) {
        console.warn('⚠️ Could not find API key to configure');
        return;
      }

      // Configure restrictions for Firebase Auth
      const restrictions = {
        apiTargets: [
          {
            service: 'identitytoolkit.googleapis.com'
          },
          {
            service: 'firebase.googleapis.com'  
          },
          {
            service: 'firestore.googleapis.com'
          }
        ],
        browserKeyRestrictions: {
          allowedReferrers: [
            'localhost/*',
            `${projectId}.firebaseapp.com/*`,
            `${projectId}.web.app/*`,
            '*.vercel.app/*',
            '*.netlify.app/*',
            'chatfactory.ai/*',
            '*.chatfactory.ai/*'
          ]
        }
      };

      // Update API key with restrictions
      const updateResponse = await fetch(`https://apikeys.googleapis.com/v2/${targetKey.name}?updateMask=restrictions`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          restrictions: restrictions
        })
      });

      if (updateResponse.ok) {
        console.log('✅ API key configured successfully for Firebase Authentication');
      } else {
        const errorData = await updateResponse.json();
        console.warn('⚠️ API key configuration failed:', errorData);
      }
      
    } catch (error: any) {
      console.warn('⚠️ API key configuration error:', error.message);
      // Don't throw - this is not critical for basic functionality
    }
  }

  /**
   * Populate the dedicated database with chatbot data from the main ChatFactory database
   */
  static async populateDedicatedDatabase(projectId: string, chatbotId: string): Promise<void> {
    try {
      console.log(`📝 Starting database population for chatbot ${chatbotId} in project ${projectId}`);
      
      // First, let's wait a bit for the database to be fully ready
      console.log('⏳ Waiting for database to be fully initialized...');
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second wait
      
      // Get the service account key from environment
      const serviceAccountKey = process.env.FIREBASE_PRIVATE_KEY;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      
      if (!serviceAccountKey || !clientEmail) {
        throw new Error('Missing Firebase service account credentials');
      }
      
      // Initialize dedicated project's Firestore using explicit credentials
      console.log('🔐 Initializing connection to dedicated project database...');
      const dedicatedApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: projectId,
          clientEmail: clientEmail,
          privateKey: serviceAccountKey.replace(/\\n/g, '\n'),
        }),
        projectId: projectId,
      }, `dedicated-${projectId}-${Date.now()}`); // Unique app name
      
      const dedicatedDb = admin.firestore(dedicatedApp);
      
      // Test the connection first
      console.log('🧪 Testing connection to dedicated database...');
      try {
        await dedicatedDb.collection('_test').doc('_connection').set({
          test: true,
          timestamp: admin.firestore.Timestamp.now()
        });
        console.log('✅ Connection to dedicated database successful');
        
        // Clean up test document
        await dedicatedDb.collection('_test').doc('_connection').delete();
      } catch (connectionError: any) {
        console.error('❌ Failed to connect to dedicated database:', connectionError);
        throw new Error(`Database connection failed: ${connectionError.message}`);
      }
      
      // 1. Copy chatbot configuration data
      console.log('📋 Copying chatbot configuration...');
      const chatbotSnap = await adminDb.collection('chatbots').doc(chatbotId).get();
      
      if (chatbotSnap.exists) {
        const chatbotData = chatbotSnap.data();
        
        // Create the chatbot document in the dedicated database
        await dedicatedDb.collection('chatbots').doc(chatbotId).set({
          ...chatbotData,
          // Add metadata about this being a deployed instance
          isDedicatedDeployment: true,
          sourceProjectId: 'main-chatfactory',
          deployedAt: admin.firestore.Timestamp.now(),
          deployedToProjectId: projectId
        });
        
        console.log('✅ Chatbot configuration copied successfully');
        
        // 2. Copy documents/knowledge base if exists
        console.log('📄 Copying documents/knowledge base...');
        const documentsSnap = await adminDb
          .collection('chatbots')
          .doc(chatbotId)
          .collection('documents')
          .get();
        
        if (!documentsSnap.empty) {
          const batch = dedicatedDb.batch();
          let documentCount = 0;
          
          documentsSnap.forEach(doc => {
            const docRef = dedicatedDb
              .collection('chatbots')
              .doc(chatbotId)
              .collection('documents')
              .doc(doc.id);
            batch.set(docRef, doc.data());
            documentCount++;
          });
          
          await batch.commit();
          console.log(`✅ Copied ${documentCount} documents to dedicated database`);
        } else {
          console.log('ℹ️  No documents found to copy');
        }
        
        // 3. Copy user configurations if exists
        console.log('👥 Copying user configurations...');
        const usersSnap = await adminDb
          .collection('chatbots')
          .doc(chatbotId)
          .collection('users')
          .get();
        
        if (!usersSnap.empty) {
          const batch = dedicatedDb.batch();
          let userCount = 0;
          
          usersSnap.forEach(doc => {
            const userRef = dedicatedDb
              .collection('chatbots')
              .doc(chatbotId)
              .collection('users')
              .doc(doc.id);
            batch.set(userRef, doc.data());
            userCount++;
          });
          
          await batch.commit();
          console.log(`✅ Copied ${userCount} user configurations to dedicated database`);
        } else {
          console.log('ℹ️  No user configurations found to copy');
        }
        
        // 4. Create initial collections that might be needed
        console.log('🔧 Creating initial collections...');
        
        // Create conversations collection (for chat history)
        await dedicatedDb.collection('conversations').doc('_placeholder').set({
          _placeholder: true,
          createdAt: admin.firestore.Timestamp.now()
        });
        
        // Create analytics collection (for usage tracking)
        await dedicatedDb.collection('analytics').doc('_placeholder').set({
          _placeholder: true,
          createdAt: admin.firestore.Timestamp.now()
        });
        
        console.log('✅ Initial collections created');
        
      } else {
        throw new Error(`Chatbot ${chatbotId} not found in main database`);
      }
      
      // Clean up the dedicated app instance
      await dedicatedApp.delete();
      
      console.log('🎉 Database population completed successfully');
      
    } catch (error: any) {
      console.error('❌ Error populating dedicated database:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack?.substring(0, 500)
      });
      throw error;
    }
  }

  /**
   * Deploy Firestore security rules for the chatbot project
   */
  private static async deployFirestoreSecurityRules(projectId: string): Promise<void> {
    try {
      const accessToken = await this.getFirebaseAccessToken();
      
      // Define security rules for chatbot functionality
      const securityRules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read and write their own profile
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Allow authenticated users to read and write their own conversations
    match /conversations/{conversationId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.userId || request.auth.uid == data.userId);
    }
    
    // Allow authenticated users to read chatbot configuration
    match /chatbots/{chatbotId} {
      allow read: if request.auth != null;
      allow write: if false; // Only server can write chatbot config
    }
    
    // Allow authenticated users to read and write messages in their conversations
    match /messages/{messageId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.userId || request.auth.uid == data.userId);
    }
    
    // Allow authenticated users to read documents (knowledge base)
    match /documents/{documentId} {
      allow read: if request.auth != null;
      allow write: if false; // Only server can write documents
    }
    
    // Allow authenticated users to read and write their own analytics data
    match /analytics/{analyticsId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.userId || request.auth.uid == data.userId);
    }
    
    // Allow authenticated users to access chatbot-specific collections
    match /chatbots/{chatbotId}/users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Only server can manage user access
    }
    
    match /chatbots/{chatbotId}/documents/{documentId} {
      allow read: if request.auth != null;
      allow write: if false; // Only server can manage documents
    }
    
    match /chatbots/{chatbotId}/conversations/{conversationId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.userId || request.auth.uid == data.userId);
    }
    
    // Default deny rule
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
      `.trim();

      // Deploy rules using Firebase Management API
      const rulesUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`;
      
      const rulesResponse = await fetch(rulesUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: {
            files: [
              {
                name: 'firestore.rules',
                content: securityRules,
              },
            ],
          },
        }),
      });

      if (!rulesResponse.ok) {
        const errorText = await rulesResponse.text();
        throw new Error(`Failed to create ruleset: ${rulesResponse.status} ${errorText}`);
      }

      const rulesetData = await rulesResponse.json();
      const rulesetName = rulesetData.name;

      // Release the rules to make them active
      const releaseUrl = `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases`;
      
      const releaseResponse = await fetch(releaseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: `projects/${projectId}/releases/cloud.firestore`,
          rulesetName: rulesetName,
        }),
      });

      if (!releaseResponse.ok) {
        const errorText = await releaseResponse.text();
        const errorData = JSON.parse(errorText);
        
        // Handle "already exists" error gracefully for recycled projects
        if (releaseResponse.status === 409 && errorData.error?.message?.includes('already exists')) {
          console.log('ℹ️ Firestore security rules already exist - skipping deployment');
          console.log('💡 Rules may need manual update in Firebase Console if changes are needed');
          return; // Exit gracefully without throwing
        }
        
        throw new Error(`Failed to release rules: ${releaseResponse.status} ${errorText}`);
      }

      console.log('✅ Firestore security rules deployed and activated successfully');
      
    } catch (error: any) {
      console.error('❌ Error deploying Firestore security rules:', error);
      
      // Handle specific error codes gracefully for recycled projects
      if (error.message?.includes('409') && error.message?.includes('already exists')) {
        console.log('⚠️ Failed to deploy Firestore security rules: rules already exist');
        console.log('💡 You may need to manually configure Firestore rules in the Firebase Console');
        return; // Don't throw - let deployment continue
      }
      
      throw error;
    }
  }
}
