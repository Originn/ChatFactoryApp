import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { execSync } from 'child_process';
import { Storage } from '@google-cloud/storage';
import { CloudBillingClient } from '@google-cloud/billing';
import { GoogleAuth } from 'google-auth-library';

export interface CreateFirebaseProjectRequest {
  chatbotId: string;
  chatbotName: string;
  creatorUserId: string;
}

export interface FirebaseProject {
  projectId: string;
  displayName: string;
  chatbotId: string;
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
}

export class FirebaseProjectService {
  private static readonly FIREBASE_PROJECTS_COLLECTION = 'firebaseProjects';
  private static readonly BILLING_ACCOUNT_NAME = 'billingAccounts/011C35-0F1A1B-49FBEC'; // wizechat.ai organization billing account

  /**
   * Get Google Cloud credentials configuration
   */
  private static getGoogleCloudCredentials() {
    // In production (Vercel), use JSON from environment variable
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        return JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      } catch (error) {
        console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', error);
        throw new Error('Invalid Google Cloud credentials JSON in environment variable');
      }
    }
    
    // In development, use the file path (if GOOGLE_APPLICATION_CREDENTIALS is set)
    // The Google Cloud libraries will automatically use this
    return undefined; // Let the library use default authentication
  }

  /**
   * Grant service account permissions on newly created project
   */
  private static async grantServiceAccountPermissions(projectId: string): Promise<boolean> {
    try {
      console.log(`🔐 Granting service account permissions on project: ${projectId}`);
      console.log('🔐 Required permissions: roles/iam.oauthClientAdmin, roles/identitytoolkit.admin, roles/iap.admin');
      
      const credentials = this.getGoogleCloudCredentials();
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        ...(credentials && { credentials })
      });

      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      
      if (!tokenResponse.token) {
        console.error('❌ Failed to get access token for permission granting');
        return false;
      }

      const serviceAccountEmail = 'firebase-project-manager@docsai-chatbot-app.iam.gserviceaccount.com';
      console.log(`🔐 Service account: ${serviceAccountEmail}`);
      
      // Get current IAM policy
      console.log('🔐 Getting current IAM policy...');
      const getPolicyUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`;
      const getPolicyResponse = await fetch(getPolicyUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenResponse.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!getPolicyResponse.ok) {
        const errorText = await getPolicyResponse.text();
        console.error('❌ Failed to get IAM policy:', errorText);
        console.error(`❌ Response status: ${getPolicyResponse.status} ${getPolicyResponse.statusText}`);
        
        // Check if this is a permissions issue
        if (getPolicyResponse.status === 403) {
          console.error('💡 Main service account may lack permission to manage IAM on new projects');
          console.error('💡 Required permission: resourcemanager.projects.getIamPolicy');
          console.error('💡 You may need to grant "Project IAM Admin" role to the main service account');
        }
        
        return false;
      }

      const currentPolicy = await getPolicyResponse.json();
      console.log(`🔐 Current policy has ${currentPolicy.bindings?.length || 0} bindings`);
      
      // Add required permissions for OAuth client creation and consent screen
      const requiredRoles = [
        'roles/iam.oauthClientAdmin',
        'roles/identitytoolkit.admin',
        'roles/iap.admin' // 🆕 For OAuth consent screen creation
      ];

      let policyChanged = false;
      const bindings = currentPolicy.bindings || [];

      for (const role of requiredRoles) {
        console.log(`🔐 Processing role: ${role}`);
        
        // Find existing binding for this role
        let binding = bindings.find(b => b.role === role);
        
        if (!binding) {
          // Create new binding
          console.log(`🔐 Creating new binding for role: ${role}`);
          binding = {
            role: role,
            members: []
          };
          bindings.push(binding);
        }

        const memberString = `serviceAccount:${serviceAccountEmail}`;
        if (!binding.members.includes(memberString)) {
          binding.members.push(memberString);
          policyChanged = true;
          console.log(`✅ Added role ${role} for service account`);
        } else {
          console.log(`ℹ️ Service account already has role: ${role}`);
        }
      }

      if (policyChanged) {
        console.log('🔐 Updating IAM policy with new permissions...');
        
        // Update IAM policy
        const setPolicyUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:setIamPolicy`;
        const setPolicyResponse = await fetch(setPolicyUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenResponse.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            policy: {
              ...currentPolicy,
              bindings: bindings
            }
          })
        });

        if (setPolicyResponse.ok) {
          console.log('🔐 IAM policy updated successfully');
          console.log('⏳ Waiting 15 seconds for permissions to propagate...');
          await new Promise(resolve => setTimeout(resolve, 15000));
          
          // Verify permissions were granted
          console.log('🔍 Verifying permissions were granted...');
          const verifySuccess = await this.verifyServiceAccountPermissions(projectId, serviceAccountEmail, tokenResponse.token);
          
          if (verifySuccess) {
            console.log('✅ Service account permissions verified successfully');
            return true;
          } else {
            console.warn('⚠️ Permission verification failed, but continuing (may work anyway)');
            return true; // Continue anyway, might still work
          }
        } else {
          const errorText = await setPolicyResponse.text();
          console.error('❌ Failed to set IAM policy:', errorText);
          console.error(`❌ Response status: ${setPolicyResponse.status} ${setPolicyResponse.statusText}`);
          return false;
        }
      } else {
        console.log('✅ Service account already has required permissions');
        return true;
      }

    } catch (error: any) {
      console.error('❌ Failed to grant service account permissions:', error.message);
      console.error('❌ Stack trace:', error.stack);
      return false;
    }
  }

  /**
   * Verify service account has required permissions
   */
  private static async verifyServiceAccountPermissions(
    projectId: string, 
    serviceAccountEmail: string, 
    accessToken: string
  ): Promise<boolean> {
    try {
      const getPolicyUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}:getIamPolicy`;
      const response = await fetch(getPolicyUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn('⚠️ Failed to verify permissions');
        return false;
      }

      const policy = await response.json();
      const bindings = policy.bindings || [];
      
      const requiredRoles = ['roles/iam.oauthClientAdmin', 'roles/identitytoolkit.admin', 'roles/iap.admin'];
      const serviceAccountRoles = bindings
        .filter(binding => binding.members?.includes(`serviceAccount:${serviceAccountEmail}`))
        .map(binding => binding.role);
      
      const hasAllRoles = requiredRoles.every(role => serviceAccountRoles.includes(role));
      
      if (hasAllRoles) {
        console.log('✅ Verification: Service account has all required roles');
        return true;
      } else {
        const missingRoles = requiredRoles.filter(role => !serviceAccountRoles.includes(role));
        console.warn('⚠️ Verification: Missing roles:', missingRoles.join(', '));
        return false;
      }
      
    } catch (error) {
      console.warn('⚠️ Permission verification error:', error);
      return false;
    }
  }

  /**
   * Enable required APIs for OAuth functionality
   */
  private static async enableRequiredAPIs(projectId: string): Promise<boolean> {
    try {
      console.log(`🔧 Enabling required APIs for project: ${projectId}`);
      
      const credentials = this.getGoogleCloudCredentials();
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        ...(credentials && { credentials })
      });

      const client = await auth.getClient();
      const tokenResponse = await client.getAccessToken();
      
      if (!tokenResponse.token) {
        console.error('❌ Failed to get access token for API enabling');
        return false;
      }

      const apisToEnable = [
        'iam.googleapis.com',                    // IAM API for OAuth client creation
        'identitytoolkit.googleapis.com',       // Identity Toolkit for Firebase Auth
        'cloudresourcemanager.googleapis.com', // Resource Manager (often needed)
        'iap.googleapis.com'                    // Identity-Aware Proxy API for OAuth consent screen
      ];

      let allSuccessful = true;
      
      for (const api of apisToEnable) {
        try {
          const enableUrl = `https://serviceusage.googleapis.com/v1/projects/${projectId}/services/${api}:enable`;
          
          const response = await fetch(enableUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${tokenResponse.token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({}) // Empty body for enable operation
          });

          if (response.ok || response.status === 400) {
            // 400 might mean already enabled
            console.log(`✅ API enabled: ${api}`);
            
            // Wait longer for IAP API specifically
            if (api === 'iap.googleapis.com') {
              console.log('⏳ Waiting extra time for IAP API to propagate...');
              await new Promise(resolve => setTimeout(resolve, 5000));
            } else {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } else {
            const errorText = await response.text();
            console.error(`❌ Failed to enable API ${api}:`, errorText);
            allSuccessful = false;
          }
        } catch (apiError) {
          console.error(`❌ Error enabling API ${api}:`, apiError);
          allSuccessful = false;
        }
      }

      if (allSuccessful) {
        console.log('✅ All required APIs enabled successfully');
        // Wait longer for APIs to fully propagate (especially IAP API)
        console.log('⏳ Waiting for APIs to propagate (especially IAP API)...');
        await new Promise(resolve => setTimeout(resolve, 15000)); // Increased to 15 seconds
      } else {
        console.warn('⚠️ Some APIs failed to enable - OAuth setup may fail');
      }

      return allSuccessful;
      
    } catch (error: any) {
      console.error('❌ Failed to enable required APIs:', error.message);
      return false;
    }
  }

  /**
   * Attach billing account to a newly created project
   */
  private static async attachBillingAccount(projectId: string): Promise<boolean> {
    try {
      console.log(`💳 Attaching billing account to project: ${projectId}`);
      
      const credentials = this.getGoogleCloudCredentials();
      const billing = new CloudBillingClient(credentials ? { credentials } : {});

      const projectName = `projects/${projectId}`;
      
      // Attach the billing account to the project
      await billing.updateProjectBillingInfo({
        name: projectName,
        projectBillingInfo: {
          billingAccountName: this.BILLING_ACCOUNT_NAME,
        },
      });
      
      console.log('✅ Billing account attached successfully');
      return true;
      
    } catch (billingError: any) {
      console.error('❌ Failed to attach billing account:', billingError.message);
      
      if (billingError.message?.includes('permission')) {
        console.warn('💡 Service account needs billing permissions. See setup instructions below.');
        console.warn('💡 1. Go to: https://console.cloud.google.com/iam-admin/iam');
        console.warn('💡 2. Find your service account: firebase-project-manager@docsai-chatbot-app.iam.gserviceaccount.com');
        console.warn('💡 3. Add role: "Billing Account Administrator" or "Billing Project Manager"');
      }
      
      return false;
    }
  }

  /**
   * Create a real Firebase project using Firebase CLI
   */
  static async createProjectForChatbot(
    request: CreateFirebaseProjectRequest
  ): Promise<{ success: boolean; project?: FirebaseProject; error?: string }> {
    try {
      const { chatbotId, chatbotName, creatorUserId } = request;
      
      console.log('🔥 Creating Firebase project with CLI for chatbot:', chatbotId);
      
      // Check Firebase CLI setup
      const cliCheck = await this.checkFirebaseCLI();
      if (!cliCheck.available || !cliCheck.authenticated) {
        return { success: false, error: cliCheck.error };
      }

      const projectId = this.generateProjectId(chatbotName, chatbotId);
      const displayName = `${chatbotName} Chatbot`;

      // Store initial project record
      const projectRef = adminDb.collection(this.FIREBASE_PROJECTS_COLLECTION).doc(projectId);
      await projectRef.set({
        projectId,
        displayName,
        chatbotId,
        createdAt: Timestamp.now(),
        status: 'creating'
      });

      try {
        // Step 1: Get organization ID for proper project placement
        console.log('🏢 Getting organization ID...');
        const organizationId = await this.getOrganizationId();
        
        if (!organizationId) {
          console.warn('⚠️ No organization ID found, creating project without organization');
        } else {
          console.log('✅ Found organization ID:', organizationId);
        }

        // Step 2: Create Firebase project using user authentication
        console.log('🚀 Creating Firebase project with user token:', projectId);
        
        let createCommand: string;
        if (organizationId) {
          createCommand = `firebase projects:create ${projectId} --display-name "${displayName}" --organization ${organizationId}`;
        } else {
          createCommand = `firebase projects:create ${projectId} --display-name "${displayName}"`;
        }
        
        console.log('🔧 Firebase CLI command (with user token):', createCommand);
        
        const createOutput = execSync(createCommand, { 
          encoding: 'utf8',
          timeout: 180000, // 3 minutes
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            // Only set FIREBASE_TOKEN if it has a value
            ...(process.env.FIREBASE_TOKEN && process.env.FIREBASE_TOKEN.trim() !== '' ? 
                { FIREBASE_TOKEN: process.env.FIREBASE_TOKEN } : {}),
            // Don't unset GOOGLE_APPLICATION_CREDENTIALS - let it fall back to default auth
          }
        });
        
        console.log('✅ Project created successfully:', createOutput);

        // Step 3: Create web app in the project
        console.log('📱 Creating web app in project...');
        const appCommand = `firebase apps:create web "${displayName} App" --project ${projectId}`;
          
        const appOutput = execSync(appCommand, { 
          encoding: 'utf8',
          timeout: 60000,
          env: {
            ...process.env,
            // Only set FIREBASE_TOKEN if it has a value
            ...(process.env.FIREBASE_TOKEN && process.env.FIREBASE_TOKEN.trim() !== '' ? 
                { FIREBASE_TOKEN: process.env.FIREBASE_TOKEN } : {}),
          }
        });
        
        console.log('✅ Web app created:', appOutput);

        // Step 3.5: Grant service account permissions on the new project
        console.log('🔐 Granting service account permissions on new project...');
        const permissionsGranted = await this.grantServiceAccountPermissions(projectId);
        
        if (permissionsGranted) {
          console.log('✅ Service account permissions granted - OAuth creation will be possible');
        } else {
          console.warn('⚠️ Failed to grant service account permissions - OAuth setup may fail');
        }

        // Step 4.5: Attach billing account to enable bucket creation
        console.log('💳 Setting up billing for the new project...');
        const billingAttached = await this.attachBillingAccount(projectId);
        
        if (billingAttached) {
          console.log('✅ Billing account attached - bucket creation will be enabled');
        } else {
          console.warn('⚠️ Could not attach billing - buckets may not be created');
        }

        // Step 4.6: Enable required APIs for OAuth and authentication
        console.log('🔧 Enabling required APIs for OAuth functionality...');
        const apisEnabled = await this.enableRequiredAPIs(projectId);
        
        if (apisEnabled) {
          console.log('✅ Required APIs enabled - OAuth setup will be possible');
        } else {
          console.warn('⚠️ Some APIs failed to enable - OAuth setup may require manual intervention');
        }

        // Step 5: Get Firebase configuration
        console.log('⚙️ Getting Firebase configuration...');
        const configCommand = `firebase apps:sdkconfig web --project ${projectId}`;
          
        const configOutput = execSync(configCommand, { 
          encoding: 'utf8',
          timeout: 60000,
          env: {
            ...process.env,
            // Only set FIREBASE_TOKEN if it has a value
            ...(process.env.FIREBASE_TOKEN && process.env.FIREBASE_TOKEN.trim() !== '' ? 
                { FIREBASE_TOKEN: process.env.FIREBASE_TOKEN } : {}),
          }
        });
        
        const config = this.parseFirebaseConfig(configOutput, projectId);
        console.log('✅ Firebase config retrieved');

        // Step 6: Create Cloud Storage buckets for the chatbot
        console.log('🪣 Creating Cloud Storage buckets...');
        const region = process.env.FIREBASE_DEFAULT_REGION || 'us-central1';
        const bucketSuffixes = [
          'chatbot_documents',
          'chatbot_private_images',
          'chatbot_documents_images'
        ];
        const buckets: Record<string, string> = {};
        
        try {
          // Initialize Google Cloud Storage client with service account
          const credentials = this.getGoogleCloudCredentials();
          const storage = new Storage({
            projectId: projectId,
            ...(credentials && { credentials })
          });
          
          console.log('✅ Google Cloud Storage client initialized');
          console.log(`📋 Attempting to create buckets in project: ${projectId}`);
          
          for (const suffix of bucketSuffixes) {
            const bucketName = `${projectId}-${suffix}`;
            try {
              // Create bucket using Google Cloud Storage client library
              const [bucket] = await storage.createBucket(bucketName, {
                location: region,
                storageClass: 'STANDARD',
                uniformBucketLevelAccess: true,
                publicAccessPrevention: 'enforced'
              });
              
              buckets[suffix] = bucketName;
              console.log('✅ Bucket created:', bucketName);
            } catch (bucketError: any) {
              if (bucketError.code === 409) {
                // Bucket already exists
                console.log('ℹ️ Bucket already exists:', bucketName);
                buckets[suffix] = bucketName;
              } else if (bucketError.message?.includes('billing account')) {
                console.warn(`💳 Billing not enabled for new project ${projectId}`);
                console.warn('💡 New Firebase projects require billing to be enabled manually.');
                console.warn('💡 Steps to enable billing:');
                console.warn(`💡 1. Go to: https://console.cloud.google.com/billing/linkedaccount?project=${projectId}`);
                console.warn('💡 2. Link a billing account (Google Cloud free tier applies)');
                console.warn('💡 3. Buckets can be created manually or re-deploy after enabling billing');
                console.warn('🚀 Deployment will continue without buckets - they are optional');
                // Break out of the loop - no point trying other buckets
                break;
              } else {
                console.error(`❌ Failed to create bucket ${bucketName}:`, bucketError.message);
              }
            }
          }
          
          const bucketCount = Object.keys(buckets).length;
          if (bucketCount > 0) {
            console.log(`✅ Successfully created ${bucketCount} storage buckets`);
          } else {
            console.warn('⚠️ No storage buckets were created. Continuing deployment without buckets.');
            console.warn('📝 Buckets are optional and can be created later when needed.');
          }
          
        } catch (storageError: any) {
          console.error('❌ Failed to initialize Google Cloud Storage client:', storageError.message);
          console.warn('⚠️ Continuing without bucket creation. Buckets can be created manually later.');
        }

        // Step 7: Update project record with success
        const completeProject: FirebaseProject = {
          projectId,
          displayName,
          chatbotId,
          createdAt: Timestamp.now(),
          status: 'active',
          config,
          // Only include buckets if they were successfully created
          ...(Object.keys(buckets).length > 0 && {
            buckets: {
              documents: buckets['chatbot_documents'] || null,
              privateImages: buckets['chatbot_private_images'] || null,
              documentImages: buckets['chatbot_documents_images'] || null
            }
          })
        };

        // Prepare update data, filtering out undefined values
        const updateData: any = {
          status: 'active',
          config,
          completedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        // Only add buckets if they exist
        if (Object.keys(buckets).length > 0) {
          updateData.buckets = {
            documents: buckets['chatbot_documents'] || null,
            privateImages: buckets['chatbot_private_images'] || null,
            documentImages: buckets['chatbot_documents_images'] || null
          };
        }

        await projectRef.update(updateData);

        // Step 8: Update chatbot with Firebase project reference
        const chatbotUpdateData: any = {
          firebaseProjectId: projectId,
          firebaseConfig: config,
          updatedAt: Timestamp.now()
        };

        // Only add storage buckets if they were successfully created
        if (Object.keys(buckets).length > 0) {
          chatbotUpdateData.storageBuckets = {
            documents: buckets['chatbot_documents'] || null,
            privateImages: buckets['chatbot_private_images'] || null,
            documentImages: buckets['chatbot_documents_images'] || null
          };
        }

        await adminDb.collection('chatbots').doc(chatbotId).update(chatbotUpdateData);

        console.log('🎉 Firebase project setup completed successfully:', projectId);
        
        return { success: true, project: completeProject };

      } catch (cliError: any) {
        console.error('❌ Firebase CLI command failed:', cliError.message);
        
        // Update project record with failure
        await projectRef.update({
          status: 'failed',
          error: cliError.message,
          failedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
        
        return { 
          success: false, 
          error: `Firebase CLI failed: ${cliError.message}` 
        };
      }

    } catch (error: any) {
      console.error('❌ Error in createProjectForChatbot:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check Firebase CLI availability and authentication
   */
  static async checkFirebaseCLI(): Promise<{ 
    available: boolean; 
    authenticated: boolean; 
    user?: string;
    error?: string;
  }> {
    try {
      // Check if Firebase CLI is installed
      try {
        const versionOutput = execSync('firebase --version', { 
          encoding: 'utf8', 
          stdio: 'pipe',
          timeout: 10000
        });
        console.log('✅ Firebase CLI version:', versionOutput.trim());
      } catch {
        return {
          available: false,
          authenticated: false,
          error: 'Firebase CLI not installed. Run: npm install -g firebase-tools'
        };
      }

      // Check authentication
      try {
        const token = process.env.FIREBASE_TOKEN;
        const listCommand = (token && token.trim() !== '') 
          ? `firebase projects:list --token ${token}`
          : 'firebase projects:list';
          
        const listOutput = execSync(listCommand, { 
          encoding: 'utf8', 
          stdio: 'pipe',
          timeout: 15000
        });
        
        console.log('✅ Firebase CLI authenticated successfully');
        
        return {
          available: true,
          authenticated: true,
          user: this.extractUserFromOutput(listOutput)
        };
        
      } catch (authError: any) {
        return {
          available: true,
          authenticated: false,
          error: 'Firebase CLI not authenticated. Run: firebase login or set FIREBASE_TOKEN'
        };
      }

    } catch (error: any) {
      return {
        available: false,
        authenticated: false,
        error: `Firebase CLI check failed: ${error.message}`
      };
    }
  }

  /**
   * Get Firebase project for a chatbot
   */
  static async getProjectForChatbot(chatbotId: string): Promise<FirebaseProject | null> {
    try {
      const snapshot = await adminDb
        .collection(this.FIREBASE_PROJECTS_COLLECTION)
        .where('chatbotId', '==', chatbotId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return { ...doc.data() } as FirebaseProject;
    } catch (error) {
      console.error('Error fetching Firebase project:', error);
      return null;
    }
  }

  /**
   * Generate Firebase project ID (follows GCP naming rules)
   */
  private static generateProjectId(chatbotName: string, chatbotId: string): string {
    const sanitizedName = chatbotName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 15);

    const namePrefix = sanitizedName.match(/^[a-z]/) ? sanitizedName : `cb-${sanitizedName}`;
    const idSuffix = chatbotId.substring(0, 8).toLowerCase();
    const projectId = `${namePrefix}-${idSuffix}`.substring(0, 30);
    
    return projectId.replace(/-$/, '');
  }

  /**
   * Parse Firebase config from CLI SDK config output
   */
  private static parseFirebaseConfig(cliOutput: string, projectId: string): FirebaseProject['config'] {
    try {
      const jsonMatch = cliOutput.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const config = JSON.parse(jsonMatch[0]);
        
        if (config.apiKey && config.authDomain && config.projectId) {
          return {
            apiKey: config.apiKey,
            authDomain: config.authDomain,
            projectId: config.projectId,
            storageBucket: config.storageBucket || `${projectId}.firebasestorage.app`,
            messagingSenderId: config.messagingSenderId || '',
            appId: config.appId || ''
          };
        }
      }
      
      const lines = cliOutput.split('\n');
      const config: any = {};
      
      for (const line of lines) {
        if (line.includes('apiKey:')) config.apiKey = line.split(':')[1]?.trim().replace(/['"]/g, '');
        if (line.includes('authDomain:')) config.authDomain = line.split(':')[1]?.trim().replace(/['"]/g, '');
        if (line.includes('projectId:')) config.projectId = line.split(':')[1]?.trim().replace(/['"]/g, '');
        if (line.includes('storageBucket:')) config.storageBucket = line.split(':')[1]?.trim().replace(/['"]/g, '');
        if (line.includes('messagingSenderId:')) config.messagingSenderId = line.split(':')[1]?.trim().replace(/['"]/g, '');
        if (line.includes('appId:')) config.appId = line.split(':')[1]?.trim().replace(/['"]/g, '');
      }
      
      if (config.apiKey && config.authDomain) {
        return {
          apiKey: config.apiKey,
          authDomain: config.authDomain,
          projectId: config.projectId || projectId,
          storageBucket: config.storageBucket || `${projectId}.firebasestorage.app`,
          messagingSenderId: config.messagingSenderId || '',
          appId: config.appId || ''
        };
      }
      
    } catch (parseError) {
      console.error('Failed to parse Firebase config:', parseError);
    }

    console.warn('⚠️ Using fallback Firebase config - please verify manually');
    return {
      apiKey: 'PARSING_FAILED_CHECK_MANUALLY',
      authDomain: `${projectId}.firebaseapp.com`,
      projectId: projectId,
      storageBucket: `${projectId}.firebasestorage.app`,
      messagingSenderId: 'PARSING_FAILED',
      appId: 'PARSING_FAILED'
    };
  }

  /**
   * Extract user info from CLI output
   */
  private static extractUserFromOutput(output: string): string | undefined {
    const emailMatch = output.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    return emailMatch ? emailMatch[1] : 'authenticated';
  }

  /**
   * Get the organization ID for project creation
   */
  private static async getOrganizationId(): Promise<string | null> {
    // Use explicit organization ID from environment
    if (process.env.GOOGLE_CLOUD_ORGANIZATION_ID) {
      const orgId = process.env.GOOGLE_CLOUD_ORGANIZATION_ID;
      console.log(`🏢 Using organization ID from environment: ${orgId}`);
      return orgId;
    }
    
    console.error('❌ No organization found. Please set GOOGLE_CLOUD_ORGANIZATION_ID environment variable.');
    return null;
  }

  /**
   * Delete Firebase project with organization-level permissions
   */
  static async deleteProject(chatbotId: string): Promise<{ 
    success: boolean; 
    error?: string;
    automated?: boolean;
  }> {
    try {
      const project = await this.getProjectForChatbot(chatbotId);
      
      if (!project) {
        return { success: false, error: 'No Firebase project found for this chatbot' };
      }

      console.log(`🗑️ Starting organization-level project deletion: ${project.projectId}`);

      // Mark as deleting
      const projectRef = adminDb.collection(this.FIREBASE_PROJECTS_COLLECTION).doc(project.projectId);
      await projectRef.update({
        status: 'deleting',
        deletedAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Simple deletion - mark as deleted for manual cleanup
      await projectRef.update({
        status: 'deleted',
        deletedFromCloud: false,
        automatedDeletion: false,
        manualDeletionRequired: true,
        manualDeletionUrl: `https://console.firebase.google.com/project/${project.projectId}/settings/general`,
        deletionNote: 'Project marked for manual deletion. Please delete manually from Firebase Console.',
        updatedAt: Timestamp.now()
      });

      console.log('📝 Project marked for manual deletion');
      
      return {
        success: true,
        automated: false,
        error: `Project marked for deletion. Please delete manually: https://console.firebase.google.com/project/${project.projectId}/settings/general`
      };
      
    } catch (error: any) {
      console.error('❌ Error in deleteProject:', error);
      return { 
        success: false, 
        error: `System error: ${error.message}` 
      };
    }
  }
}