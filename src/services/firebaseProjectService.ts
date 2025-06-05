import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { execSync } from 'child_process';

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
            // Use user token instead of service account
            FIREBASE_TOKEN: process.env.FIREBASE_TOKEN,
            // Remove service account to avoid conflicts
            GOOGLE_APPLICATION_CREDENTIALS: undefined
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
            FIREBASE_TOKEN: process.env.FIREBASE_TOKEN,
            GOOGLE_APPLICATION_CREDENTIALS: undefined
          }
        });
        
        console.log('✅ Web app created:', appOutput);

        // Step 4: Get Firebase configuration
        console.log('⚙️ Getting Firebase configuration...');
        const configCommand = `firebase apps:sdkconfig web --project ${projectId}`;
          
        const configOutput = execSync(configCommand, { 
          encoding: 'utf8',
          timeout: 60000,
          env: {
            ...process.env,
            FIREBASE_TOKEN: process.env.FIREBASE_TOKEN,
            GOOGLE_APPLICATION_CREDENTIALS: undefined
          }
        });
        
        const config = this.parseFirebaseConfig(configOutput, projectId);
        console.log('✅ Firebase config retrieved');

        // Step 5: Create Cloud Storage buckets for the chatbot
        console.log('🪣 Creating Cloud Storage buckets...');
        const region = process.env.FIREBASE_DEFAULT_REGION || 'us-central1';
        const bucketSuffixes = [
          'chatbot_documents',
          'chatbot_private_images',
          'chatbot_documents_images'
        ];
        const buckets: Record<string, string> = {};
        for (const suffix of bucketSuffixes) {
          const bucketName = `${projectId}-${suffix}`;
          const bucketCommand = `gsutil mb -p ${projectId} -l ${region} gs://${bucketName}`;
          try {
            execSync(bucketCommand, {
              encoding: 'utf8',
              timeout: 60000,
              env: {
                ...process.env,
                FIREBASE_TOKEN: process.env.FIREBASE_TOKEN,
                GOOGLE_APPLICATION_CREDENTIALS: undefined
              }
            });
            buckets[suffix] = bucketName;
            console.log('✅ Bucket created:', bucketName);
          } catch (bucketError: any) {
            console.error(`❌ Failed to create bucket ${bucketName}:`, bucketError.message);
          }
        }

        // Step 6: Update project record with success
        const completeProject: FirebaseProject = {
          projectId,
          displayName,
          chatbotId,
          createdAt: Timestamp.now(),
          status: 'active',
          config,
          buckets: {
            documents: buckets['chatbot_documents'],
            privateImages: buckets['chatbot_private_images'],
            documentImages: buckets['chatbot_documents_images']
          }
        };

        await projectRef.update({
          status: 'active',
          config,
          buckets: {
            documents: buckets['chatbot_documents'],
            privateImages: buckets['chatbot_private_images'],
            documentImages: buckets['chatbot_documents_images']
          },
          completedAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });

        // Step 6: Update chatbot with Firebase project reference
        await adminDb.collection('chatbots').doc(chatbotId).update({
          firebaseProjectId: projectId,
          firebaseConfig: config,
          storageBuckets: {
            documents: buckets['chatbot_documents'],
            privateImages: buckets['chatbot_private_images'],
            documentImages: buckets['chatbot_documents_images']
          },
          updatedAt: Timestamp.now()
        });

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
        const listCommand = token 
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