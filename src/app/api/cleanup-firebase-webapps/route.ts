import { NextRequest, NextResponse } from 'next/server';
import { ReusableFirebaseProjectService } from '@/services/reusableFirebaseProjectService';
import { google } from 'googleapis';

const firebase = google.firebase('v1beta1');

/**
 * API endpoint for cleaning up duplicate Firebase web apps
 * This specifically targets apps with duplicate names like "TestBot Chatbot (Reusable) App"
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, appNamePattern } = body;

    const targetProjectId = projectId || process.env.REUSABLE_FIREBASE_PROJECT_ID;
    const targetAppName = appNamePattern || 'TestBot Chatbot (Reusable) App';
    
    if (!targetProjectId) {
      return NextResponse.json({ 
        error: 'No project ID provided and REUSABLE_FIREBASE_PROJECT_ID not set' 
      }, { status: 400 });
    }

    console.log('🧹 API: Starting cleanup of duplicate Firebase web apps');
    console.log(`🎯 Target project: ${targetProjectId}`);
    console.log(`🎯 Target app name: "${targetAppName}"`);

    // Get auth client for Firebase Management API
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    
    const authClient = await auth.getClient();
    
    // List all web apps in the Firebase project
    console.log('🔍 Listing all web apps in project...');
    
    const listResponse = await firebase.projects.webApps.list({
      parent: `projects/${targetProjectId}`,
      auth: authClient as any
    });
    
    const webApps = listResponse.data.apps || [];
    console.log(`📱 Found ${webApps.length} total web apps in project`);
    
    // Filter apps that match the specific name pattern
    const matchingApps = webApps.filter(app => 
      app.displayName === targetAppName
    );
    
    console.log(`🎯 Found ${matchingApps.length} web apps matching "${targetAppName}"`);
    
    if (matchingApps.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No duplicate web apps found with name "${targetAppName}"`,
        totalApps: webApps.length,
        matchingApps: 0,
        deletedApps: 0
      });
    }
    
    // Show details of all matching apps
    const appDetails = matchingApps.map(app => ({
      appId: app.appId,
      displayName: app.displayName,
      name: app.name
    }));
    
    console.log('🔍 Matching apps details:', appDetails);
    
    // Delete duplicate apps (keep the first one, delete the rest)
    const appsToDelete = matchingApps.slice(1); // Keep first, delete rest
    let deletedCount = 0;
    const deleteResults = [];
    
    for (const app of appsToDelete) {
      try {
        console.log(`🗑️ IMMEDIATELY deleting duplicate web app: ${app.displayName} (${app.appId})`);
        
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
        deleteResults.push({
          appId: app.appId,
          displayName: app.displayName,
          status: 'deleted'
        });
        
        console.log(`✅ Successfully deleted: ${app.displayName}`);
        
      } catch (deleteError: any) {
        console.warn(`⚠️ Could not delete web app ${app.displayName}:`, deleteError.message);
        deleteResults.push({
          appId: app.appId,
          displayName: app.displayName,
          status: 'failed',
          error: deleteError.message
        });
      }
    }
    
    const summary = {
      success: true,
      message: `Cleaned up ${deletedCount}/${appsToDelete.length} duplicate web apps`,
      totalAppsInProject: webApps.length,
      matchingApps: matchingApps.length,
      keptApps: 1, // We keep the first one
      deletedApps: deletedCount,
      failedDeletions: appsToDelete.length - deletedCount,
      results: deleteResults
    };
    
    console.log('✅ API: Web app cleanup completed:', summary);
    
    return NextResponse.json(summary);

  } catch (error: any) {
    console.error('❌ API: Error during web app cleanup:', error);
    
    return NextResponse.json({ 
      error: `Web app cleanup failed: ${error.message}`,
      details: error
    }, { status: 500 });
  }
}

/**
 * GET endpoint to list all Firebase web apps in the project
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

    console.log('🔍 API: Listing Firebase web apps for project:', projectId);

    // Get auth client for Firebase Management API
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    
    const authClient = await auth.getClient();
    
    // List all web apps
    const listResponse = await firebase.projects.webApps.list({
      parent: `projects/${projectId}`,
      auth: authClient as any
    });
    
    const webApps = listResponse.data.apps || [];
    
    // Group apps by display name to show duplicates
    const appsByName: { [key: string]: any[] } = {};
    
    webApps.forEach(app => {
      const name = app.displayName || 'Unnamed App';
      if (!appsByName[name]) {
        appsByName[name] = [];
      }
      appsByName[name].push({
        appId: app.appId,
        displayName: app.displayName,
        name: app.name
      });
    });
    
    // Find duplicates
    const duplicates = Object.entries(appsByName)
      .filter(([name, apps]) => apps.length > 1)
      .map(([name, apps]) => ({
        displayName: name,
        count: apps.length,
        apps: apps
      }));
    
    return NextResponse.json({
      success: true,
      projectId,
      totalApps: webApps.length,
      uniqueNames: Object.keys(appsByName).length,
      duplicateGroups: duplicates.length,
      duplicates,
      allApps: Object.entries(appsByName).map(([name, apps]) => ({
        displayName: name,
        count: apps.length,
        apps: apps
      }))
    });

  } catch (error: any) {
    console.error('❌ API: Error listing web apps:', error);
    
    return NextResponse.json({ 
      error: `Failed to list web apps: ${error.message}` 
    }, { status: 500 });
  }
}