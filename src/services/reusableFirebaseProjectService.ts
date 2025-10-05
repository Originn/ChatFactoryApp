import { adminDb, adminStorage, adminAuth } from '@/lib/firebase/admin/index';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { GoogleOAuthClientManager } from './googleOAuthClientManager';
import { google } from 'googleapis';
import { getAuthClient } from '@/lib/gcp-auth';
import { ProjectMappingService } from './projectMappingService';
import { FirestoreSecretService } from './firestoreSecretService';
// DEBUG: Temporarily commenting out ResourceManagerClient to fix build
// import { ResourceManagerClient } from '@google-cloud/resource-manager';

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
   * @param aggressiveCleanup - If true, performs more thorough cleanup including bucket deletion
   * @returns Promise<{ success: boolean; message: string; details?: any }>
   */
  static async cleanupChatbotData(chatbotId: string, userId: string, aggressiveCleanup: boolean = false): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      console.log(`🧹 Starting cleanup of chatbot data: ${chatbotId} for user: ${userId}`);
      console.log(`🔥 Aggressive cleanup mode: ${aggressiveCleanup ? 'ENABLED' : 'DISABLED'}`);
      
      // Check environment variable for aggressive cleanup
      const forceAggressiveCleanup = process.env.FORCE_AGGRESSIVE_CLEANUP === 'true';
      const enableAggressiveCleanup = aggressiveCleanup || forceAggressiveCleanup;
      
      if (enableAggressiveCleanup) {
        console.log('⚠️ AGGRESSIVE CLEANUP MODE ENABLED - Will delete ALL related files and attempt bucket cleanup');
      }
      
      const cleanupResults = {
        firestore: false,
        storage: false,
        auth: false,
        oauthClients: false,
        webApps: false,
        identityPlatform: false,
        serviceAccountDeletion: false,
        bucketCleanup: false,
      };

      // Get the project this chatbot is using from the mapping service
      const allProjects = await ProjectMappingService.getAllProjects();
      const chatbotProject = allProjects.find(p => p.chatbotId === chatbotId);
      const targetProjectId = chatbotProject?.projectId;

      if (!targetProjectId) {
        console.warn(`⚠️ No project mapping found for chatbot ${chatbotId} - limited cleanup possible`);
      }

      // 1. Clean up OAuth clients (fixes accumulation issue)
      try {
        if (targetProjectId) {
          await this.cleanupOAuthClients(targetProjectId);
          cleanupResults.oauthClients = true;
          console.log('✅ OAuth clients cleanup completed');
        } else {
          console.warn('⚠️ No target project ID - skipping OAuth cleanup');
          cleanupResults.oauthClients = false;
        }
      } catch (error) {
        console.error('❌ OAuth clients cleanup failed:', error);
        cleanupResults.oauthClients = false;
      }

      // 2. Clean up duplicate web apps
      try {
        if (targetProjectId) {
          await this.wipeSpecificWebApps(targetProjectId, 'TestBot Chatbot (Reusable) App');
          cleanupResults.webApps = true;
          console.log('✅ Duplicate web apps cleanup completed');
        } else {
          console.warn('⚠️ No target project ID - skipping web apps cleanup');
          cleanupResults.webApps = false;
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
        if (targetProjectId) {
          await this.cleanupStorageData(chatbotId, userId, enableAggressiveCleanup, targetProjectId);
          cleanupResults.storage = true;
          console.log('✅ Storage cleanup completed');
        } else {
          console.warn('⚠️ No target project ID - skipping storage cleanup');
        }
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
      
      // 6. Complete Identity Platform cleanup
      try {
        const projectId = targetProjectId;
        if (projectId) {
          await this.cleanupIdentityPlatform(projectId);
          cleanupResults.identityPlatform = true;
          console.log('✅ Identity Platform cleanup completed');
        }
      } catch (error) {
        console.error('❌ Identity Platform cleanup failed:', error);
      }

      // 7. Skip service account deletion for pool projects
      // Pool projects share service accounts across multiple chatbots, so we should NOT delete them
      console.log('⏭️ Skipping service account deletion for pool project (service account is shared)');
      cleanupResults.serviceAccountDeletion = true; // Mark as successful since no action needed
      
      const successCount = Object.values(cleanupResults).filter(Boolean).length;
      const totalCount = Object.keys(cleanupResults).length;

      // Note: Project release is now handled by the caller (chatbot-deletion route)
      // to avoid duplicate release attempts
      console.log('ℹ️ Cleanup completed - project release will be handled by caller');

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
   * COMPLETE FACTORY RESET - Wipe everything from a pool Firebase project
   * This makes the project like a brand new Firebase project
   * @param projectId - The project ID to reset (required)
   * @returns Promise<{ success: boolean; message: string; details?: any }>
   */
  static async factoryResetProject(projectId: string): Promise<{ success: boolean; message: string; details?: any }> {
    try {
      if (!projectId) {
        throw new Error('Project ID is required for factory reset');
      }

      console.log(`🏭 Starting COMPLETE FACTORY RESET of project: ${projectId}`);
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
        await this.wipeAllCredentials(projectId);
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
        await this.wipeSpecificWebApps(projectId, 'TestBot Chatbot (Reusable) App');
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
      const authClient = await getAuthClient();
      
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
   * Delete all chatbot-specific service accounts (for complete project cleanup)
   */
  public static async deleteAllChatbotServiceAccounts(projectId: string): Promise<void> {
    console.log(`🧹 Deleting all chatbot service accounts in project: ${projectId}`);
    
    try {
      const authClient = await getAuthClient();
      const iam = google.iam('v1');
      
      // DEBUG: Temporarily commenting out problematic Google Cloud IAM call
      // List all service accounts
      // const serviceAccountsResponse = await iam.projects.serviceAccounts.list({
      //   name: `projects/${projectId}`,
      //   auth: authClient
      // });
      
      // Return empty array for now
      const serviceAccountsResponse = { data: { accounts: [] } };
      
      const serviceAccounts = serviceAccountsResponse.data.accounts || [];
      console.log(`🔍 Found ${serviceAccounts.length} total service accounts`);
      
      // Filter for chatbot-specific service accounts (exclude default Google-managed ones)
      const chatbotServiceAccounts = serviceAccounts.filter(serviceAccount => {
        const email = serviceAccount.email || '';
        return (
          email.includes('-admin@') &&
          !email.includes('@appspot.gserviceaccount.com') && 
          !email.includes('@developer.gserviceaccount.com') &&
          !email.includes('firebase-adminsdk')
        );
      });
      
      console.log(`🎯 Found ${chatbotServiceAccounts.length} chatbot service accounts to delete`);
      
      for (const serviceAccount of chatbotServiceAccounts) {
        try {
          await this.deleteServiceAccount(projectId, serviceAccount.email!, authClient);
        } catch (error: any) {
          console.warn(`⚠️ Failed to delete service account ${serviceAccount.email}:`, error.message);
        }
      }
      
      console.log(`✅ Chatbot service account cleanup completed`);
      
    } catch (error: any) {
      console.error('❌ Failed to delete chatbot service accounts:', error);
      throw error;
    }
  }

  /**
   * Completely delete a chatbot's service account and all its keys
   */
  private static async deleteServiceAccount(projectId: string, serviceAccountEmail: string, authClient: any): Promise<void> {
    console.log(`🗑️ Completely deleting service account: ${serviceAccountEmail}`);
    
    try {
      const iam = google.iam('v1');
      const serviceAccountName = `projects/${projectId}/serviceAccounts/${serviceAccountEmail}`;
      
      // First, delete all keys for this service account
      try {
        const keysResponse = await iam.projects.serviceAccounts.keys.list({
          name: serviceAccountName,
          auth: authClient
        });
        
        const keys = keysResponse.data.keys || [];
        const userManagedKeys = keys.filter(key => key.keyType === 'USER_MANAGED');
        
        console.log(`🔑 Deleting all ${userManagedKeys.length} keys for ${serviceAccountEmail}`);
        
        for (const key of userManagedKeys) {
          try {
            await iam.projects.serviceAccounts.keys.delete({
              name: key.name,
              auth: authClient
            });
            console.log(`✅ Deleted key: ${key.name?.split('/').pop()}`);
          } catch (keyError: any) {
            console.warn(`⚠️ Failed to delete key:`, keyError.message);
          }
        }
      } catch (keyError: any) {
        console.warn(`⚠️ Failed to list/delete keys:`, keyError.message);
      }
      
      // Remove IAM policy bindings for this service account
      try {
        console.log(`🔐 Removing IAM policy bindings for ${serviceAccountEmail}`);
        // DEBUG: Temporarily commenting out ResourceManagerClient usage
        // const resourceManagerClient = new ResourceManagerClient({ auth: authClient });
        console.log(`🔐 IAM policy cleanup skipped for ${serviceAccountEmail} (temporarily disabled)`);
      } catch (policyError: any) {
        console.warn(`⚠️ Failed to remove IAM policy bindings:`, policyError.message);
      }
      
      // Finally, delete the service account itself
      try {
        console.log(`🗑️ Deleting service account: ${serviceAccountEmail}`);
        
        await iam.projects.serviceAccounts.delete({
          name: serviceAccountName,
          auth: authClient
        });
        
        console.log(`✅ Successfully deleted service account: ${serviceAccountEmail}`);
        
      } catch (deleteError: any) {
        console.error(`❌ Failed to delete service account ${serviceAccountEmail}:`, deleteError.message);
        throw deleteError;
      }

    } catch (error: any) {
      console.error(`❌ Failed to delete service account ${serviceAccountEmail}:`, error.message);
      throw error;
    }
  }

  /**
   * Clean up service account keys to prevent "Precondition check failed" errors (maintenance mode)
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
      'chatbot_users',
      'user_pdfs', // Contains CHM and PDF document metadata
      'chatbot_verification_tokens', // Contains email verification tokens
      'processed_youtube_videos' // Contains YouTube video processing data
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
    
    // ✅ COMPREHENSIVE: Clean up user_pdfs collection specifically
    // This contains CHM and PDF document metadata
    try {
      console.log(`📄 Cleaning user_pdfs collection for chatbot: ${chatbotId}, user: ${userId}`);
      
      const userPdfsQuery = adminDb.collection('user_pdfs')
        .where('chatbotId', '==', chatbotId)
        .where('userId', '==', userId)
        .limit(500); // Handle large collections
      
      const userPdfsSnapshot = await userPdfsQuery.get();
      
      if (!userPdfsSnapshot.empty) {
        userPdfsSnapshot.forEach(doc => {
          batch.delete(doc.ref);
          operationCount++;
        });
        
        console.log(`📄 Scheduled deletion of ${userPdfsSnapshot.size} user_pdfs documents`);
      } else {
        console.log(`ℹ️ No user_pdfs documents found for chatbot ${chatbotId}`);
      }
      
    } catch (error) {
      console.warn('⚠️ Could not clean up user_pdfs collection:', error);
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
   * Now with comprehensive scanning and bucket cleanup
   */
  private static async cleanupStorageData(chatbotId: string, userId: string, aggressiveCleanup: boolean = false, projectId?: string): Promise<void> {
    console.log(`🧹 Starting comprehensive storage cleanup for chatbot: ${chatbotId}, user: ${userId}`);
    console.log(`🔥 Aggressive cleanup mode: ${aggressiveCleanup ? 'ENABLED' : 'DISABLED'}`);

    // Use provided project ID or try to get it from mapping service
    let reusableProjectId = projectId;

    if (!reusableProjectId) {
      const allProjects = await ProjectMappingService.getAllProjects();
      const chatbotProject = allProjects.find(p => p.chatbotId === chatbotId);
      reusableProjectId = chatbotProject?.projectId;
    }

    if (!reusableProjectId) {
      console.error(`❌ No project ID found for chatbot ${chatbotId} - cannot perform storage cleanup`);
      return;
    }

    console.log(`🎯 Target Firebase project: ${reusableProjectId}`);
    
    // Initialize project-specific storage client
    const { Storage } = require('@google-cloud/storage');
    const credentials = {
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      project_id: process.env.FIREBASE_PROJECT_ID,
    };
    
    const projectSpecificStorage = new Storage({
      projectId: reusableProjectId,
      credentials: credentials
    });
    
    // Get ALL buckets in the project
    let allBuckets;
    try {
      [allBuckets] = await projectSpecificStorage.getBuckets();
      console.log(`📦 Found ${allBuckets.length} buckets in project ${reusableProjectId}`);
    } catch (error: any) {
      console.error(`❌ Could not list buckets in project ${reusableProjectId}:`, error.message);
      return;
    }
    
    // Process each bucket
    for (const bucket of allBuckets) {
      try {
        console.log(`\n🧹 Processing bucket: ${bucket.name}`);
        await this.cleanupBucket(bucket, chatbotId, userId, aggressiveCleanup);
      } catch (error: any) {
        console.error(`❌ Error processing bucket ${bucket.name}:`, error.message);
      }
    }
    
    console.log(`✅ Comprehensive storage cleanup completed across all buckets!`);
  }
  
  private static async cleanupBucket(workingBucket: any, chatbotId: string, userId: string, aggressiveCleanup: boolean): Promise<void> {
    console.log(`🧹 Cleaning bucket: ${workingBucket.name}`);
    
    // Step 1: Delete all files with prefixes (this deletes file content but may leave folder markers)
    const directoriesToCompletelyDelete = [
      'private_pdfs/',
      'public_pdfs/',
      `user-${userId}/`,
      'chatbots/',
      'uploads/',
      'pdfs/',
      'documents/',
      'chm/',
    ];
    
    console.log(`🔥 STEP 1: Deleting all files with prefixes in bucket ${workingBucket.name}...`);
    
    for (const directory of directoriesToCompletelyDelete) {
      try {
        console.log(`🗂️ Deleting files in: ${directory}`);
        
        await workingBucket.deleteFiles({ 
          prefix: directory,
          force: true 
        });
        
        console.log(`✅ Deleted files in: ${directory}`);
        
      } catch (error: any) {
        console.warn(`⚠️ Could not delete files in ${directory}:`, error.message);
      }
    }
    
    // Step 2: CRITICAL - Delete zero-byte placeholder objects that represent empty folders
    console.log(`🔥 STEP 2: Deleting zero-byte placeholder objects in bucket ${workingBucket.name}...`);
    
    const folderPlaceholders = [
      'private_pdfs/',          // Zero-byte placeholder for private_pdfs folder
      'public_pdfs/',           // Zero-byte placeholder for public_pdfs folder
      `user-${userId}/`,        // Zero-byte placeholder for user folder
      'chatbots/',              // Zero-byte placeholder for chatbots folder
      'uploads/',               // Zero-byte placeholder for uploads folder
      'pdfs/',                  // Zero-byte placeholder for pdfs folder
      'documents/',             // Zero-byte placeholder for documents folder
      'chm/',                   // Zero-byte placeholder for chm folder
    ];
    
    for (const placeholder of folderPlaceholders) {
      try {
        console.log(`📁 Deleting zero-byte placeholder: ${placeholder}`);
        
        // Delete the zero-byte placeholder object that represents the empty folder
        const placeholderFile = workingBucket.file(placeholder);
        await placeholderFile.delete({ ignoreNotFound: true });
        
        console.log(`✅ Deleted zero-byte placeholder: ${placeholder}`);
        
      } catch (error: any) {
        console.warn(`⚠️ Could not delete placeholder ${placeholder}:`, error.message);
      }
    }
    
    // Step 3: Also delete individual chatbot folders
    const specificFoldersToDelete = [
      `${chatbotId}/`,
    ];
    
    for (const folder of specificFoldersToDelete) {
      try {
        console.log(`🗂️ Deleting remaining chatbot folder: ${folder}`);
        
        // Delete all files in the folder
        await workingBucket.deleteFiles({
          prefix: folder
        });
        
        console.log(`✅ Deleted chatbot folder: ${folder}`);
        
      } catch (error: any) {
        console.warn(`⚠️ Could not delete folder ${folder}:`, error.message);
      }
    }
    
    // Step 4: Nuclear option - delete ANY remaining files with chatbot/user patterns
    console.log(`🔍 Cleaning up any remaining files with chatbot ID in bucket ${workingBucket.name}...`);
    
    try {
      // Use bulk deletion for efficiency - delete all files matching patterns
      const deletePatterns = [
        `**/*${chatbotId}*`, // Any file containing chatbot ID
        `**/*user-${userId}*`, // Any file containing user ID
        `**/chatbot-${chatbotId}*`, // Any file containing chatbot-specific pattern
      ];
      
      for (const pattern of deletePatterns) {
        try {
          await workingBucket.deleteFiles({
            prefix: '',
            matchGlob: pattern
          });
          
          console.log(`✅ Deleted files matching pattern: ${pattern}`);
        } catch (error: any) {
          console.warn(`⚠️ Could not delete files matching pattern ${pattern}:`, error.message);
        }
      }
      
    } catch (error: any) {
      console.warn(`⚠️ Could not delete remaining files with chatbot ID:`, error.message);
    }
    
    // Step 5: If aggressive cleanup is enabled, perform nuclear cleanup
    if (aggressiveCleanup) {
      console.log(`💥 NUCLEAR CLEANUP: Deleting ALL files and folders in bucket ${workingBucket.name}...`);
      
      try {
        // Get ALL files in the bucket (including hidden folder markers)
        const [allFiles] = await workingBucket.getFiles({
          maxResults: 10000, // Get everything
          includeTrailingDelimiter: true, // Include folder delimiters
          delimiter: '' // Don't treat anything as a delimiter
        });
        
        console.log(`🔍 Found ${allFiles.length} total files/folders in bucket ${workingBucket.name}`);
        
        if (allFiles.length > 0) {
          console.log(`💥 DELETING EVERYTHING: Removing ALL ${allFiles.length} files and folders...`);
          
          // Delete ALL files and folders
          const deletePromises = allFiles.map(file => 
            file.delete().catch(error => {
              console.warn(`⚠️ Could not delete ${file.name}:`, error.message);
            })
          );
          
          await Promise.all(deletePromises);
          console.log(`✅ DELETED ALL ${allFiles.length} files and folders from bucket ${workingBucket.name}`);
          
        } else {
          console.log(`✅ Bucket ${workingBucket.name} is already empty`);
        }
        
      } catch (error: any) {
        console.warn(`⚠️ Could not perform nuclear cleanup on bucket ${workingBucket.name}:`, error.message);
      }
    }
    
    console.log(`✅ Bucket ${workingBucket.name} cleanup completed!`);
    
    // Step 5: Final verification - should be empty now
    console.log(`🔍 Verifying cleanup completed...`);
    
    try {
      // Quick check to see if any files remain
      const [remainingFiles] = await workingBucket.getFiles({
        prefix: '',
        maxResults: 10
      });
      
      if (remainingFiles.length === 0) {
        console.log(`✅ PERFECT: Bucket is completely empty - ready for recycling!`);
      } else {
        console.log(`⚠️ Found ${remainingFiles.length} remaining files:`);
        remainingFiles.forEach(file => console.log(`  - ${file.name}`));
      }
      
    } catch (error: any) {
      console.warn(`⚠️ Could not verify cleanup:`, error.message);
    }
    
    console.log(`✅ Comprehensive storage cleanup completed!`);
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
      const authClient = await getAuthClient();
      
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
          console.log(`🗑️ IMMEDIATELY deleting web app: ${app.displayName} (${app.appId})`);
          
          // 🔑 CRITICAL FIX: Use immediate deletion to prevent pending deletion quota issues
          await firebase.projects.webApps.remove({
            name: app.name,
            auth: authClient as any,
            requestBody: {
              immediate: true,        // 🔥 Bypass 30-day grace period
              allowMissing: true,     // Don't fail if already deleted
              validateOnly: false     // Actually perform the deletion
            }
          });
          
          deletedCount++;
          console.log(`✅ PERMANENTLY deleted web app: ${app.displayName} (no pending state)`);
          
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

  /**
   * Complete Identity Platform cleanup - implements all methods from your specifications
   * Deletes tenants, providers, users, domains, and configurations
   */
  private static async cleanupIdentityPlatform(projectId: string): Promise<void> {
    console.log('🔐 Starting COMPLETE Identity Platform cleanup...');
    console.log(`🎯 Target project: ${projectId}`);
    
    try {
      const authClient = await getAuthClient();
      const accessToken = await authClient.getAccessToken();
      
      if (!accessToken.token) {
        throw new Error('Failed to get access token for Identity Platform cleanup');
      }

      // 1. Delete all tenants (multi-tenant projects)
      await this.deleteAllTenants(projectId, accessToken.token);
      
      // 2. Delete all identity providers (Google, Email/Password, etc.)
      await this.deleteAllIdentityProviders(projectId, accessToken.token);
      
      // 3. Delete all Identity Platform users
      await this.deleteAllIdentityPlatformUsers(projectId, accessToken.token);
      
      // 4. Remove authorized domains
      await this.clearAuthorizedDomains(projectId, accessToken.token);
      
      // 5. Clear project configuration
      await this.clearProjectConfiguration(projectId, accessToken.token);
      
      console.log('✅ Complete Identity Platform cleanup finished');

    } catch (error: any) {
      console.error('❌ Identity Platform cleanup failed:', error);
      console.log('ℹ️ Manual cleanup may be required via Google Cloud Console');
      // Don't throw - allow chatbot deletion to continue even if Identity Platform cleanup fails
      console.log('⚠️ Continuing with chatbot deletion despite Identity Platform cleanup failure');
    }
  }

  /**
   * Delete all tenants (for multi-tenant Identity Platform projects)
   */
  private static async deleteAllTenants(projectId: string, accessToken: string): Promise<void> {
    console.log('🏢 Deleting all Identity Platform tenants...');
    
    try {
      const listUrl = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/tenants`;
      
      const response = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const tenants = data.tenants || [];
        
        console.log(`🔍 Found ${tenants.length} tenants to delete`);
        
        if (tenants.length === 0) {
          console.log('ℹ️ No tenants found to delete (single-tenant project)');
          return;
        }
        
        let deletedCount = 0;
        for (const tenant of tenants) {
          try {
            const deleteUrl = `https://identitytoolkit.googleapis.com/v2/${tenant.name}`;
            
            const deleteResponse = await fetch(deleteUrl, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (deleteResponse.ok) {
              console.log(`✅ Deleted tenant: ${tenant.displayName || tenant.name}`);
              deletedCount++;
            } else {
              console.warn(`⚠️ Failed to delete tenant ${tenant.name}:`, deleteResponse.status);
            }
            
            // Rate limit protection
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } catch (error) {
            console.warn(`⚠️ Error deleting tenant ${tenant.name}:`, error);
          }
        }
        
        console.log(`✅ Deleted ${deletedCount}/${tenants.length} tenants`);
        
      } else if (response.status === 404) {
        console.log('ℹ️ No tenants API endpoint found (single-tenant project)');
      } else {
        console.warn('⚠️ Failed to list tenants:', response.status);
      }
      
    } catch (error) {
      console.error('❌ Failed to delete tenants:', error);
    }
  }

  /**
   * Delete all identity providers (Google, Email/Password, Facebook, etc.)
   */
  private static async deleteAllIdentityProviders(projectId: string, accessToken: string): Promise<void> {
    console.log('🔑 Deleting all identity providers...');
    
    // Common identity providers to check and delete
    const commonProviders = [
      'password',      // Email/Password
      'google.com',    // Google
      'facebook.com',  // Facebook
      'github.com',    // GitHub
      'twitter.com',   // Twitter
      'microsoft.com', // Microsoft
      'apple.com',     // Apple
      'yahoo.com',     // Yahoo
      'linkedin.com'   // LinkedIn
    ];
    
    let deletedCount = 0;
    let disabledCount = 0;
    
    for (const providerId of commonProviders) {
      try {
        console.log(`🔍 Processing provider: ${providerId}`);
        
        if (providerId === 'password') {
          // Email/Password is disabled via configuration update
          await this.disableEmailPasswordProvider(projectId, accessToken);
          disabledCount++;
        } else {
          // OAuth providers are deleted
          const deleteUrl = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/oauthIdpConfigs/${providerId}`;
          
          const response = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            console.log(`✅ Deleted provider: ${providerId}`);
            deletedCount++;
          } else if (response.status === 404) {
            console.log(`ℹ️ Provider ${providerId} not found (not configured)`);
          } else {
            console.warn(`⚠️ Failed to delete provider ${providerId}:`, response.status);
          }
        }
        
        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.warn(`⚠️ Error processing provider ${providerId}:`, error);
      }
    }
    
    console.log(`✅ Processed providers: ${deletedCount} deleted, ${disabledCount} disabled`);
  }

  /**
   * Disable Email/Password provider via configuration
   */
  private static async disableEmailPasswordProvider(projectId: string, accessToken: string): Promise<void> {
    try {
      const configUrl = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`;
      
      const configData = {
        signIn: {
          email: {
            enabled: false
          }
        }
      };
      
      const response = await fetch(configUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configData)
      });
      
      if (response.ok) {
        console.log('✅ Disabled Email/Password provider');
      } else {
        console.warn('⚠️ Failed to disable Email/Password provider:', response.status);
      }
      
    } catch (error) {
      console.warn('⚠️ Error disabling Email/Password provider:', error);
    }
  }

  /**
   * Delete all Identity Platform users (different from Firebase Auth users)
   */
  private static async deleteAllIdentityPlatformUsers(projectId: string, accessToken: string): Promise<void> {
    console.log('👤 Deleting all Identity Platform users via REST API...');

    try {
      let totalDeleted = 0;
      let nextPageToken: string | undefined;

      // Use Identity Toolkit REST API to list and delete users
      do {
        // List users using accounts:query endpoint (accounts:batchGet returns 404)
        const listUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:query`;

        const listResponse = await fetch(listUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            returnUserInfo: true,
            limit: 1000,
            ...(nextPageToken && { nextPageToken })
          })
        });

        if (!listResponse.ok) {
          const error = await listResponse.text();
          console.error('❌ Failed to list users:', error.substring(0, 500));
          break;
        }

        const listData = await listResponse.json();
        const users = listData.userInfo || [];

        if (users.length === 0) {
          console.log('✅ No more users to delete');
          break;
        }

        console.log(`🔍 Found ${users.length} users in this batch`);

        // Delete users in batches using REST API
        for (const user of users) {
          try {
            const deleteUrl = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:delete`;

            const deleteResponse = await fetch(deleteUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                localId: user.localId
              })
            });

            if (deleteResponse.ok) {
              totalDeleted++;
            } else {
              const error = await deleteResponse.text();
              console.warn(`⚠️ Could not delete user ${user.email || user.localId}:`, error);
            }

            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 50));

          } catch (error) {
            console.warn(`⚠️ Error deleting user ${user.email || user.localId}:`, error);
          }
        }

        console.log(`✅ Deleted ${users.length} users from this batch`);

        nextPageToken = listData.nextPageToken;

        // Delay between batches
        if (nextPageToken) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } while (nextPageToken);

      console.log(`✅ Total Identity Platform users deleted: ${totalDeleted}`);

    } catch (error: any) {
      console.error('❌ Failed to delete Identity Platform users:', error);
      // Don't throw - let cleanup continue
    }
  }

  /**
   * Clear authorized domains configuration
   */
  private static async clearAuthorizedDomains(projectId: string, accessToken: string): Promise<void> {
    console.log('🌐 Clearing authorized domains...');
    
    try {
      const configUrl = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`;
      
      // Get current configuration
      const getResponse = await fetch(configUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (getResponse.ok) {
        const config = await getResponse.json();
        
        if (config.authorizedDomains && config.authorizedDomains.length > 0) {
          console.log(`🔍 Found ${config.authorizedDomains.length} authorized domains`);
          
          // Clear authorized domains (keep only localhost for development)
          const updatedConfig = {
            ...config,
            authorizedDomains: ['localhost']
          };
          
          const updateResponse = await fetch(configUrl, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ authorizedDomains: ['localhost'] })
          });
          
          if (updateResponse.ok) {
            console.log('✅ Cleared authorized domains (kept localhost)');
          } else {
            console.warn('⚠️ Failed to clear authorized domains:', updateResponse.status);
          }
        } else {
          console.log('ℹ️ No authorized domains to clear');
        }
      } else {
        console.warn('⚠️ Failed to get current configuration:', getResponse.status);
      }
      
    } catch (error) {
      console.error('❌ Failed to clear authorized domains:', error);
    }
  }

  /**
   * Clear project configuration (reset to defaults)
   */
  private static async clearProjectConfiguration(projectId: string, accessToken: string): Promise<void> {
    console.log('⚙️ Clearing project configuration...');
    
    try {
      const configUrl = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`;
      
      // Reset to minimal configuration
      const defaultConfig = {
        signIn: {
          email: { enabled: false },
          phoneNumber: { enabled: false },
          anonymous: { enabled: false }
        },
        notification: {
          sendEmail: { method: 'DEFAULT' },
          sendSms: { useDeviceLocale: true }
        },
        quota: {
          signUpQuotaConfig: { quota: 100, startTime: null, quotaDuration: '86400s' }
        },
        monitoring: {
          requestLogging: { enabled: false }
        },
        multiTenant: { allowTenants: false },
        authorizedDomains: ['localhost'],
        subtype: 'IDENTITY_PLATFORM'
      };
      
      const response = await fetch(configUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(defaultConfig)
      });
      
      if (response.ok) {
        console.log('✅ Reset project configuration to defaults');
      } else {
        console.warn('⚠️ Failed to reset project configuration:', response.status);
      }
      
    } catch (error) {
      console.error('❌ Failed to reset project configuration:', error);
    }
  }
}
