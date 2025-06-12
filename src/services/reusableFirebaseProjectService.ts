import { adminDb, adminStorage, adminAuth } from '@/lib/firebase/admin/index';
import { FieldValue } from 'firebase-admin/firestore';
import { GoogleOAuthClientManager } from './googleOAuthClientManager';
import { google } from 'googleapis';

// Initialize Firebase Management API
const firebase = google.firebase('v1beta1');

/**
 * Service for managing reusable Firebase project cleanup
 * This service handles cleaning up chatbot-specific data from a reusable Firebase project
 */
export class ReusableFirebaseProjectService {
  
  /**
   * Clean up all chatbot-specific data from a reusable Firebase project
   * @param chatbotId - The ID of the chatbot to clean up
   * @param userId - The ID of the user who owned the chatbot
   * @returns Promise<{ success: boolean; message: string; details?: any }>
   */
  static async cleanupChatbotData(chatbotId: string, userId: string): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log(`🧹 Starting cleanup of chatbot data: ${chatbotId} for user: ${userId}`);
      
      const cleanupResults = {
        firestore: false,
        storage: false,
        auth: false,
        oauthClients: false,
        webApps: false,
      };

      // 1. Clean up OAuth clients (fixes accumulation issue)
      try {
        const projectId = process.env.REUSABLE_FIREBASE_PROJECT_ID;
        if (projectId) {
          await this.cleanupOAuthClients(projectId);
          cleanupResults.oauthClients = true;
          console.log('✅ OAuth clients cleanup completed');
        } else {
          console.warn('⚠️ REUSABLE_FIREBASE_PROJECT_ID not set - skipping OAuth cleanup');
        }
      } catch (error) {
        console.error('❌ OAuth clients cleanup failed:', error);
        // Don't throw - continue with other cleanup tasks
        // But store the error for reporting
        cleanupResults.oauthClients = false;
      }

      // 2. Clean up duplicate web apps
      try {
        const projectId = process.env.REUSABLE_FIREBASE_PROJECT_ID;
        if (projectId) {
          await this.wipeSpecificWebApps(projectId, 'TestBot Chatbot (Reusable) App');
          cleanupResults.webApps = true;
          console.log('✅ Duplicate web apps cleanup completed');
        }
      } catch (error) {
        console.error('❌ Web apps cleanup failed:', error);
      }
      
      // 3. Clean up Firestore data
      try {
        await this.cleanupFirestoreData(chatbotId, userId);
        cleanupResults.firestore = true;
        console.log('✅ Firestore cleanup completed');
      } catch (error) {
        console.error('❌ Firestore cleanup failed:', error);
      }
      
      // 4. Clean up Storage files
      try {
        await this.cleanupStorageData(chatbotId, userId);
        cleanupResults.storage = true;
        console.log('✅ Storage cleanup completed');
      } catch (error) {
        console.error('❌ Storage cleanup failed:', error);
      }
      
      // 5. Clean up Authentication users (optional - may want to keep for audit)
      try {
        await this.cleanupAuthUsers(chatbotId);
        cleanupResults.auth = true;
        console.log('✅ Auth cleanup completed');
      } catch (error) {
        console.error('❌ Auth cleanup failed:', error);
      }
      
      const successCount = Object.values(cleanupResults).filter(Boolean).length;
      const totalCount = Object.keys(cleanupResults).length;
      
      return {
        success: successCount > 0,
        message: `Cleanup completed: ${successCount}/${totalCount} services cleaned successfully`,
        details: cleanupResults
      };
      
    } catch (error: any) {
      console.error('❌ Error during chatbot data cleanup:', error);
      return {
        success: false,
        message: `Cleanup failed: ${error.message}`,
        details: error
      };
    }
  }

  /**
   * Clean up OAuth clients (removes the accumulating "Web client (auto created by Google Service)" entries)
   */
  private static async cleanupOAuthClients(projectId: string): Promise<void> {
    console.log('🔐 Starting OAuth clients cleanup...');
    console.log(`🎯 Target project: ${projectId}`);
    
    try {
      // First, list all OAuth clients to see what we're dealing with
      const oauthClients = await GoogleOAuthClientManager.listOAuthClients(projectId);
      console.log(`🔍 Found ${oauthClients.length} OAuth clients`);
      
      // Log details of each client for debugging
      oauthClients.forEach((client, index) => {
        console.log(`📋 OAuth Client ${index + 1}:`, {
          name: client.name,
          displayName: client.displayName,
          clientId: client.clientId,
          creationTime: client.creationTime
        });
      });
      
      if (oauthClients.length === 0) {
        console.log('✅ No OAuth clients found - cleanup not needed');
        return;
      }
      
      let deletedCount = 0;
      let failedCount = 0;
      
      // Attempt to delete each OAuth client
      for (const client of oauthClients) {
        try {
          console.log(`🗑️ Attempting to delete OAuth client: ${client.displayName || client.name || client.clientId}`);
          
          // Try different possible client identifiers
          const clientIdentifier = client.name || client.clientId;
          if (!clientIdentifier) {
            console.warn(`⚠️ No valid identifier found for OAuth client:`, client);
            failedCount++;
            continue;
          }
          
          const success = await GoogleOAuthClientManager.deleteOAuthClient(projectId, clientIdentifier);
          
          if (success) {
            console.log(`✅ Deleted OAuth client: ${client.displayName || clientIdentifier}`);
            deletedCount++;
          } else {
            console.error(`❌ Failed to delete OAuth client: ${client.displayName || clientIdentifier}`);
            failedCount++;
          }
          
          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          console.error(`❌ Error deleting OAuth client ${client.name}:`, error);
          failedCount++;
        }
      }
      
      console.log(`🏁 OAuth cleanup completed: ${deletedCount} deleted, ${failedCount} failed`);
      
      if (failedCount > 0) {
        throw new Error(`OAuth cleanup partially failed: ${failedCount} out of ${oauthClients.length} clients could not be deleted`);
      }
      
    } catch (error) {
      console.error('❌ OAuth clients cleanup failed:', error);
      // Re-throw to let the calling code know cleanup failed
      throw error;
    }
  }

  /**
   * COMPLETE FACTORY RESET - Wipe everything from the reusable Firebase project
   * This makes the project like a brand new Firebase project
   * @param projectId - The project ID to reset (optional, uses REUSABLE_FIREBASE_PROJECT_ID if not provided)
   * @returns Promise<{ success: boolean; message: string; details?: any }>
   */
  static async factoryResetProject(projectId?: string): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      const targetProjectId = projectId || process.env.REUSABLE_FIREBASE_PROJECT_ID;
      
      if (!targetProjectId) {
        throw new Error('No project ID provided and REUSABLE_FIREBASE_PROJECT_ID not set');
      }

      console.log(`🏭 Starting COMPLETE FACTORY RESET of project: ${targetProjectId}`);
      console.log('⚠️  This will delete ALL data, users, and credentials in the project!');
      
      const resetResults = {
        credentials: false,
        firestore: false,
        storage: false,
        auth: false,
        webApps: false,
      };

      // Step 1: Delete ALL credentials (OAuth clients, service accounts, API keys)
      try {
        await this.wipeAllCredentials(targetProjectId);
        resetResults.credentials = true;
        console.log('✅ All credentials wiped');
      } catch (error) {
        console.error('❌ Credential wipe failed:', error);
      }

      // Step 2: Wipe ALL Firestore data
      try {
        await this.wipeAllFirestoreCollections();
        resetResults.firestore = true;
        console.log('✅ All Firestore data wiped');
      } catch (error) {
        console.error('❌ Firestore wipe failed:', error);
      }

      // Step 3: Delete ALL storage data
      try {
        await this.wipeAllStorageFiles();
        resetResults.storage = true;
        console.log('✅ All storage data wiped');
      } catch (error) {
        console.error('❌ Storage wipe failed:', error);
      }

      // Step 4: Delete ALL Firebase Auth users
      try {
        await this.wipeAllAuthUsers();
        resetResults.auth = true;
        console.log('✅ All auth users wiped');
      } catch (error) {
        console.error('❌ Auth wipe failed:', error);
      }

      // Step 5: Delete duplicate Firebase web apps (specific name pattern)
      try {
        await this.wipeSpecificWebApps(targetProjectId, 'TestBot Chatbot (Reusable) App');
        resetResults.webApps = true;
        console.log('✅ Duplicate web apps wiped');
      } catch (error) {
        console.error('❌ Web app wipe failed:', error);
      }
      try {
        await this.wipeAllAuthUsers();
        resetResults.auth = true;
        console.log('✅ All auth users wiped');
      } catch (error) {
        console.error('❌ Auth wipe failed:', error);
      }

      const successCount = Object.values(resetResults).filter(Boolean).length;
      const totalCount = Object.keys(resetResults).length;
      
      console.log(`🏭 FACTORY RESET COMPLETE: ${successCount}/${totalCount} services reset successfully`);
      console.log('✨ Project is now in factory-fresh state, ready for new deployment!');
      
      return {
        success: successCount > 0,
        message: `Factory reset completed: ${successCount}/${totalCount} services reset successfully`,
        details: resetResults
      };
      
    } catch (error: any) {
      console.error('❌ Error during factory reset:', error);
      return {
        success: false,
        message: `Factory reset failed: ${error.message}`,
        details: error
      };
    }
  }

  /**
   * Wipe ALL credentials from the project (OAuth clients, service accounts, API keys)
   */
  private static async wipeAllCredentials(projectId: string): Promise<void> {
    console.log('🗑️ Wiping ALL credentials from project...');
    
    try {
      // Get auth client for Google Cloud APIs
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      
      const authClient = await auth.getClient();
      
      // 1. Delete all OAuth clients
      const oauthClients = await GoogleOAuthClientManager.listOAuthClients(projectId);
      console.log(`🔍 Found ${oauthClients.length} OAuth clients to delete`);
      
      for (const client of oauthClients) {
        try {
          await GoogleOAuthClientManager.deleteOAuthClient(projectId, client.name);
          console.log(`🗑️ Deleted OAuth client: ${client.name}`);
        } catch (error) {
          console.warn(`⚠️ Could not delete OAuth client ${client.name}:`, error);
        }
      }
      
      // 2. Delete service account keys (THIS IS THE FIX!)
      await this.cleanupServiceAccountKeys(projectId, authClient);
      
      console.log('✅ Credential cleanup completed');
      
    } catch (error) {
      console.error('❌ Failed to wipe credentials:', error);
      throw error;
    }
  }

  /**
   * Clean up service account keys to prevent "Precondition check failed" errors
   */
  private static async cleanupServiceAccountKeys(projectId: string, authClient: any): Promise<void> {
    console.log('🔑 Cleaning up service account keys...');
    
    try {
      const iam = google.iam('v1');
      
      // List all service accounts in the project
      const serviceAccountsResponse = await iam.projects.serviceAccounts.list({
        name: `projects/${projectId}`,
        auth: authClient
      });
      
      const serviceAccounts = serviceAccountsResponse.data.accounts || [];
      console.log(`🔍 Found ${serviceAccounts.length} service accounts`);
      
      for (const serviceAccount of serviceAccounts) {
        try {
          // Skip default service accounts (they're managed by Google)
          if (serviceAccount.email?.includes('@appspot.gserviceaccount.com') || 
              serviceAccount.email?.includes('@developer.gserviceaccount.com')) {
            console.log(`⏭️ Skipping default service account: ${serviceAccount.email}`);
            continue;
          }
          
          console.log(`🔍 Checking keys for service account: ${serviceAccount.email}`);
          
          // List keys for this service account
          const keysResponse = await iam.projects.serviceAccounts.keys.list({
            name: serviceAccount.name,
            auth: authClient
          });
          
          const keys = keysResponse.data.keys || [];
          const userManagedKeys = keys.filter(key => key.keyType === 'USER_MANAGED');
          
          console.log(`🔑 Found ${userManagedKeys.length} user-managed keys for ${serviceAccount.email}`);
          
          // Delete old keys (keep only the most recent 2)
          if (userManagedKeys.length > 2) {
            const keysToDelete = userManagedKeys
              .sort((a, b) => (b.validAfterTime || '').localeCompare(a.validAfterTime || ''))
              .slice(2); // Keep first 2 (most recent), delete rest
            
            console.log(`🗑️ Deleting ${keysToDelete.length} old keys for ${serviceAccount.email}`);
            
            for (const key of keysToDelete) {
              try {
                await iam.projects.serviceAccounts.keys.delete({
                  name: key.name,
                  auth: authClient
                });
                console.log(`✅ Deleted key: ${key.name}`);
              } catch (keyError) {
                console.warn(`⚠️ Could not delete key ${key.name}:`, keyError);
              }
            }
          } else {
            console.log(`✅ Service account ${serviceAccount.email} has acceptable number of keys (${userManagedKeys.length})`);
          }
          
        } catch (serviceAccountError) {
          console.warn(`⚠️ Could not process service account ${serviceAccount.email}:`, serviceAccountError);
        }
      }
      
      console.log('✅ Service account key cleanup completed');
      
    } catch (error) {
      console.error('❌ Failed to cleanup service account keys:', error);
      throw error;
    }
  }

  /**
   * Wipe ALL Firestore collections and documents
   */
  private static async wipeAllFirestoreCollections(): Promise<void> {
    console.log('🗑️ Wiping ALL Firestore data...');
    
    try {
      // List all collections
      const collections = await adminDb.listCollections();
      console.log(`🔍 Found ${collections.length} collections to delete`);
      
      let totalDeleted = 0;
      
      for (const collection of collections) {
        try {
          console.log(`🗂️ Deleting collection: ${collection.id}`);
          
          // Delete collection in batches
          const batchSize = 100;
          let deleted = 0;
          
          while (true) {
            const snapshot = await collection.limit(batchSize).get();
            
            if (snapshot.empty) {
              break;
            }
            
            const batch = adminDb.batch();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            
            deleted += snapshot.size;
            totalDeleted += snapshot.size;
            
            console.log(`📄 Deleted ${deleted} documents from ${collection.id}`);
          }
          
          console.log(`✅ Collection ${collection.id} wiped (${deleted} documents)`);
          
        } catch (error) {
          console.warn(`⚠️ Could not delete collection ${collection.id}:`, error);
        }
      }
      
      console.log(`✅ Total Firestore documents deleted: ${totalDeleted}`);
      
    } catch (error) {
      console.error('❌ Failed to wipe Firestore data:', error);
      throw error;
    }
  }

  /**
   * Wipe ALL files from Firebase Storage
   */
  private static async wipeAllStorageFiles(): Promise<void> {
    console.log('🗑️ Wiping ALL storage files...');
    
    try {
      const bucket = adminStorage.bucket();
      
      // Get all files in the bucket
      const [files] = await bucket.getFiles();
      console.log(`🔍 Found ${files.length} storage files to delete`);
      
      if (files.length === 0) {
        console.log('ℹ️ No storage files found to delete');
        return;
      }
      
      // Delete files in batches to avoid memory issues
      const batchSize = 100;
      let totalDeleted = 0;
      
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        
        const deletePromises = batch.map(file => 
          file.delete().catch(error => {
            console.warn(`⚠️ Could not delete file ${file.name}:`, error);
          })
        );
        
        await Promise.all(deletePromises);
        totalDeleted += batch.length;
        
        console.log(`📁 Deleted batch ${Math.ceil((i + 1) / batchSize)} (${batch.length} files)`);
      }
      
      console.log(`✅ Total storage files deleted: ${totalDeleted}`);
      
    } catch (error) {
      console.error('❌ Failed to wipe storage files:', error);
      throw error;
    }
  }

  /**
   * Wipe ALL Firebase Auth users
   */
  private static async wipeAllAuthUsers(): Promise<void> {
    console.log('🗑️ Wiping ALL Firebase Auth users...');
    
    try {
      let totalDeleted = 0;
      let nextPageToken: string | undefined;
      
      do {
        // List users in batches
        const listUsersResult = await adminAuth.listUsers(1000, nextPageToken);
        
        if (listUsersResult.users.length === 0) {
          break;
        }
        
        console.log(`🔍 Found ${listUsersResult.users.length} users in this batch`);
        
        // Delete users in smaller batches to avoid rate limits
        const deletePromises = listUsersResult.users.map(user => 
          adminAuth.deleteUser(user.uid).catch(error => {
            console.warn(`⚠️ Could not delete user ${user.uid}:`, error);
          })
        );
        
        await Promise.all(deletePromises);
        totalDeleted += listUsersResult.users.length;
        
        console.log(`👤 Deleted ${listUsersResult.users.length} auth users`);
        
        nextPageToken = listUsersResult.pageToken;
        
      } while (nextPageToken);
      
      console.log(`✅ Total auth users deleted: ${totalDeleted}`);
      
    } catch (error) {
      console.error('❌ Failed to wipe auth users:', error);
      throw error;
    }
  }
  
  /**
   * Clean up Firestore collections related to a specific chatbot
   */
  private static async cleanupFirestoreData(chatbotId: string, userId: string): Promise<void> {
    const batch = adminDb.batch();
    let operationCount = 0;
    
    // Collections that might contain chatbot-specific data
    const collectionsToCheck = [
      'messages',
      'conversations', 
      'documents',
      'analytics',
      'user_sessions',
      'chatbot_users'
    ];
    
    for (const collectionName of collectionsToCheck) {
      try {
        // Query for documents related to this chatbot
        const query = adminDb.collection(collectionName)
          .where('chatbotId', '==', chatbotId)
          .limit(100); // Process in batches to avoid timeout
        
        const snapshot = await query.get();
        
        snapshot.forEach(doc => {
          batch.delete(doc.ref);
          operationCount++;
        });
        
        console.log(`📄 Found ${snapshot.size} documents in ${collectionName} for chatbot ${chatbotId}`);
        
      } catch (error) {
        console.warn(`⚠️ Could not query collection ${collectionName}:`, error);
        // Continue with other collections
      }
    }
    
    // Also clean up the main chatbot document if it exists in the reusable project
    try {
      const chatbotRef = adminDb.collection('chatbots').doc(chatbotId);
      const chatbotDoc = await chatbotRef.get();
      
      if (chatbotDoc.exists) {
        batch.delete(chatbotRef);
        operationCount++;
        console.log(`📄 Scheduled deletion of main chatbot document: ${chatbotId}`);
      }
    } catch (error) {
      console.warn('⚠️ Could not clean up main chatbot document:', error);
    }
    
    // Clean up Firebase project records for reusable projects
    // These are stored with compound IDs: ${projectId}-${chatbotId}
    try {
      const reusableProjectId = process.env.REUSABLE_FIREBASE_PROJECT_ID;
      if (reusableProjectId) {
        const compoundId = `${reusableProjectId}-${chatbotId}`;
        const projectRef = adminDb.collection('firebaseProjects').doc(compoundId);
        const projectDoc = await projectRef.get();
        
        if (projectDoc.exists) {
          batch.delete(projectRef);
          operationCount++;
          console.log(`📄 Scheduled deletion of reusable project record: ${compoundId}`);
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not clean up reusable project record:', error);
    }
    
    // Execute batch operations
    if (operationCount > 0) {
      await batch.commit();
      console.log(`✅ Deleted ${operationCount} Firestore documents`);
    } else {
      console.log('ℹ️ No Firestore documents found to delete');
    }
  }
  
  /**
   * Clean up Firebase Storage files related to a specific chatbot
   */
  private static async cleanupStorageData(chatbotId: string, userId: string): Promise<void> {
    const bucket = adminStorage.bucket();
    
    // Paths that might contain chatbot-specific files
    const pathsToClean = [
      `user-${userId}/chatbot-logos/chatbot-${chatbotId}/`,
      `user-${userId}/chatbot-documents/chatbot-${chatbotId}/`,
      `chatbots/${chatbotId}/`,
      `uploads/${chatbotId}/`,
    ];
    
    let totalFilesDeleted = 0;
    
    for (const path of pathsToClean) {
      try {
        console.log(`🗂️ Checking storage path: ${path}`);
        
        const [files] = await bucket.getFiles({
          prefix: path,
          maxResults: 1000 // Limit to avoid memory issues
        });
        
        if (files.length > 0) {
          console.log(`📁 Found ${files.length} files in ${path}`);
          
          // Delete files in batches
          const deletePromises = files.map(file => 
            file.delete().catch(error => {
              console.warn(`⚠️ Could not delete file ${file.name}:`, error);
            })
          );
          
          await Promise.all(deletePromises);
          totalFilesDeleted += files.length;
          
          console.log(`✅ Deleted ${files.length} files from ${path}`);
        } else {
          console.log(`ℹ️ No files found in ${path}`);
        }
        
      } catch (error) {
        console.warn(`⚠️ Could not clean up storage path ${path}:`, error);
      }
    }
    
    console.log(`✅ Total storage files deleted: ${totalFilesDeleted}`);
  }
  
  /**
   * Clean up Firebase Auth users related to a specific chatbot
   * Note: This is optional and might not be desired in all cases
   */
  private static async cleanupAuthUsers(chatbotId: string): Promise<void> {
    // Note: Firebase Admin SDK doesn't have a direct way to query users by custom claims
    // This is a placeholder for future implementation
    
    console.log(`ℹ️ Auth user cleanup for chatbot ${chatbotId} is not implemented yet`);
    console.log('ℹ️ Consider implementing this based on your auth strategy:');
    console.log('  - Query users with chatbotId in custom claims');
    console.log('  - Delete or disable chatbot-specific users');
    console.log('  - Clean up user metadata');
    
    // TODO: Implement auth user cleanup based on your specific auth strategy
    // Examples:
    // - auth.listUsers() and filter by custom claims
    // - Keep a separate collection tracking chatbot users
    // - Use Firebase Auth triggers to manage user lifecycle
  }

  /**
   * Delete specific Firebase web apps by name pattern
   */
  private static async wipeSpecificWebApps(projectId: string, appNamePattern: string): Promise<void> {
    console.log(`🗑️ Deleting Firebase web apps matching: "${appNamePattern}"`);
    
    try {
      // Get auth client for Firebase Management API
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
      });
      
      const authClient = await auth.getClient();
      
      // List all web apps in the Firebase project
      console.log(`🔍 Listing web apps in project: ${projectId}`);
      
      const listResponse = await firebase.projects.webApps.list({
        parent: `projects/${projectId}`,
        auth: authClient as any
      });
      
      const webApps = listResponse.data.apps || [];
      console.log(`🔍 Found ${webApps.length} total web apps in project`);
      
      // Filter apps that match the specific name pattern
      const matchingApps = webApps.filter(app => 
        app.displayName === appNamePattern
      );
      
      console.log(`🎯 Found ${matchingApps.length} web apps matching "${appNamePattern}"`);
      
      if (matchingApps.length === 0) {
        console.log('ℹ️ No matching web apps found to delete');
        return;
      }
      
      // Delete each matching app
      let deletedCount = 0;
      
      for (const app of matchingApps) {
        try {
          console.log(`🗑️ Deleting web app: ${app.displayName} (${app.appId})`);
          
          await firebase.projects.webApps.remove({
            name: app.name,
            auth: authClient as any
          });
          
          deletedCount++;
          console.log(`✅ Deleted web app: ${app.displayName}`);
          
        } catch (deleteError: any) {
          console.warn(`⚠️ Could not delete web app ${app.displayName}:`, deleteError.message);
        }
      }
      
      console.log(`✅ Successfully deleted ${deletedCount}/${matchingApps.length} matching web apps`);
      
    } catch (error: any) {
      console.error('❌ Failed to delete specific web apps:', error);
      throw error;
    }
  }
}
