import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

/**
 * API endpoint for cleaning up service account keys
 * This fixes "Precondition check failed" errors during key creation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId } = body;

    const targetProjectId = projectId || process.env.REUSABLE_FIREBASE_PROJECT_ID;
    
    if (!targetProjectId) {
      return NextResponse.json({ 
        error: 'No project ID provided and REUSABLE_FIREBASE_PROJECT_ID not set' 
      }, { status: 400 });
    }

    console.log('🔑 API: Starting service account key cleanup');
    console.log(`🎯 Target project: ${targetProjectId}`);

    // Get auth client for Google Cloud IAM API
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    
    const iam = google.iam({ version: 'v1', auth });
    
    // List all service accounts in the project
    console.log('🔍 Listing service accounts...');
    
    const serviceAccountsResponse = await iam.projects.serviceAccounts.list({
      name: `projects/${targetProjectId}`
    });
    
    const serviceAccounts = serviceAccountsResponse.data.accounts || [];
    console.log(`🔍 Found ${serviceAccounts.length} service accounts`);
    
    const cleanupResults = [];
    let totalKeysDeleted = 0;
    
    for (const serviceAccount of serviceAccounts) {
      try {
        // Skip default service accounts (they're managed by Google)
        if (serviceAccount.email?.includes('@appspot.gserviceaccount.com') || 
            serviceAccount.email?.includes('@developer.gserviceaccount.com')) {
          console.log(`⏭️ Skipping default service account: ${serviceAccount.email}`);
          cleanupResults.push({
            email: serviceAccount.email,
            status: 'skipped',
            reason: 'default service account'
          });
          continue;
        }
        
        console.log(`🔍 Checking keys for: ${serviceAccount.email}`);
        
        // List keys for this service account
        const keysResponse = await iam.projects.serviceAccounts.keys.list({
          name: serviceAccount.name
        });
        
        const keys = keysResponse.data.keys || [];
        const userManagedKeys = keys.filter(key => key.keyType === 'USER_MANAGED');
        
        console.log(`🔑 Found ${userManagedKeys.length} user-managed keys`);
        
        if (userManagedKeys.length <= 2) {
          console.log(`✅ Service account has acceptable number of keys (${userManagedKeys.length})`);
          cleanupResults.push({
            email: serviceAccount.email,
            status: 'ok',
            totalKeys: userManagedKeys.length,
            deletedKeys: 0
          });
          continue;
        }
        
        // Delete old keys (keep only the most recent 2)
        const keysToDelete = userManagedKeys
          .sort((a, b) => (b.validAfterTime || '').localeCompare(a.validAfterTime || ''))
          .slice(2); // Keep first 2 (most recent), delete rest
        
        console.log(`🗑️ Deleting ${keysToDelete.length} old keys`);
        
        let deletedCount = 0;
        const deleteErrors = [];
        
        for (const key of keysToDelete) {
          try {
            await iam.projects.serviceAccounts.keys.delete({
              name: key.name
            });
            deletedCount++;
            totalKeysDeleted++;
            console.log(`✅ Deleted key: ${key.name?.split('/').pop()}`);
          } catch (keyError: any) {
            console.warn(`⚠️ Could not delete key ${key.name?.split('/').pop()}:`, keyError.message);
            deleteErrors.push({
              keyId: key.name?.split('/').pop(),
              error: keyError.message
            });
          }
        }
        
        cleanupResults.push({
          email: serviceAccount.email,
          status: 'cleaned',
          totalKeys: userManagedKeys.length,
          deletedKeys: deletedCount,
          keptKeys: userManagedKeys.length - deletedCount,
          errors: deleteErrors.length > 0 ? deleteErrors : undefined
        });
        
      } catch (serviceAccountError: any) {
        console.warn(`⚠️ Could not process service account ${serviceAccount.email}:`, serviceAccountError.message);
        cleanupResults.push({
          email: serviceAccount.email,
          status: 'error',
          error: serviceAccountError.message
        });
      }
    }
    
    const summary = {
      success: true,
      message: `Service account key cleanup completed. Deleted ${totalKeysDeleted} old keys.`,
      projectId: targetProjectId,
      serviceAccountsProcessed: serviceAccounts.length,
      totalKeysDeleted,
      results: cleanupResults
    };
    
    console.log('✅ API: Service account key cleanup completed:', summary);
    
    return NextResponse.json(summary);

  } catch (error: any) {
    console.error('❌ API: Error during service account key cleanup:', error);
    
    return NextResponse.json({ 
      error: `Service account key cleanup failed: ${error.message}`,
      details: error
    }, { status: 500 });
  }
}

/**
 * GET endpoint to list service account keys and identify issues
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId') || process.env.REUSABLE_FIREBASE_PROJECT_ID;
    
    if (!projectId) {
      return NextResponse.json({ 
        error: 'No project ID provided' 
      }, { status: 400 });
    }

    console.log('🔍 API: Listing service account keys for project:', projectId);

    // Get auth client for Google Cloud IAM API
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    
    const iam = google.iam({ version: 'v1', auth });
    
    // List all service accounts
    const serviceAccountsResponse = await iam.projects.serviceAccounts.list({
      name: `projects/${projectId}`
    });
    
    const serviceAccounts = serviceAccountsResponse.data.accounts || [];
    const accountDetails = [];
    let totalUserKeys = 0;
    let problematicAccounts = 0;
    
    for (const serviceAccount of serviceAccounts) {
      try {
        // Get keys for this service account
        const keysResponse = await iam.projects.serviceAccounts.keys.list({
          name: serviceAccount.name
        });
        
        const keys = keysResponse.data.keys || [];
        const userManagedKeys = keys.filter(key => key.keyType === 'USER_MANAGED');
        const systemManagedKeys = keys.filter(key => key.keyType === 'SYSTEM_MANAGED');
        
        totalUserKeys += userManagedKeys.length;
        
        const isProblematic = userManagedKeys.length > 5; // More than 5 keys is concerning
        if (isProblematic) problematicAccounts++;
        
        accountDetails.push({
          email: serviceAccount.email,
          displayName: serviceAccount.displayName,
          isDefault: serviceAccount.email?.includes('@appspot.gserviceaccount.com') || 
                     serviceAccount.email?.includes('@developer.gserviceaccount.com'),
          userManagedKeys: userManagedKeys.length,
          systemManagedKeys: systemManagedKeys.length,
          totalKeys: keys.length,
          isProblematic,
          keyDetails: userManagedKeys.map(key => ({
            keyId: key.name?.split('/').pop(),
            validAfterTime: key.validAfterTime,
            validBeforeTime: key.validBeforeTime
          }))
        });
        
      } catch (error: any) {
        accountDetails.push({
          email: serviceAccount.email,
          error: error.message
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      projectId,
      totalServiceAccounts: serviceAccounts.length,
      totalUserManagedKeys: totalUserKeys,
      problematicAccounts,
      recommendation: problematicAccounts > 0 ? 
        `${problematicAccounts} service accounts have too many keys. Run POST to clean up.` :
        'All service accounts have acceptable number of keys.',
      accounts: accountDetails
    });

  } catch (error: any) {
    console.error('❌ API: Error listing service account keys:', error);
    
    return NextResponse.json({ 
      error: `Failed to list service account keys: ${error.message}` 
    }, { status: 500 });
  }
}