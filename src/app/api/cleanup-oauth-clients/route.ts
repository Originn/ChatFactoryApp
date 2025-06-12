import { NextRequest, NextResponse } from 'next/server';
import { GoogleOAuthClientManager } from '@/services/googleOAuthClientManager';

/**
 * API endpoint for cleaning up OAuth 2.0 clients
 * This fixes the accumulation of "Web client (auto created by Google Service)" entries
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

    console.log('🔐 API: Starting OAuth client cleanup');
    console.log(`🎯 Target project: ${targetProjectId}`);

    // List all OAuth clients
    console.log('🔍 Listing OAuth clients...');
    
    const oauthClients = await GoogleOAuthClientManager.listOAuthClients(targetProjectId);
    console.log(`🔍 Found ${oauthClients.length} OAuth clients`);
    
    if (oauthClients.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No OAuth clients found to delete',
        totalClients: 0,
        deletedClients: 0
      });
    }
    
    // Show details of all OAuth clients
    const clientDetails = oauthClients.map(client => ({
      name: client.name,
      displayName: client.displayName,
      clientId: client.clientId
    }));
    
    console.log('🔍 OAuth clients to delete:', clientDetails);
    
    // Delete all OAuth clients
    let deletedCount = 0;
    const deleteResults = [];
    
    for (const client of oauthClients) {
      try {
        console.log(`🗑️ Deleting OAuth client: ${client.displayName || client.name}`);
        
        await GoogleOAuthClientManager.deleteOAuthClient(targetProjectId, client.name);
        
        deletedCount++;
        deleteResults.push({
          name: client.name,
          displayName: client.displayName,
          status: 'deleted'
        });
        
        console.log(`✅ Successfully deleted: ${client.displayName || client.name}`);
        
      } catch (deleteError: any) {
        console.warn(`⚠️ Could not delete OAuth client ${client.name}:`, deleteError.message);
        deleteResults.push({
          name: client.name,
          displayName: client.displayName,
          status: 'failed',
          error: deleteError.message
        });
      }
    }
    
    const summary = {
      success: true,
      message: `OAuth client cleanup completed. Deleted ${deletedCount}/${oauthClients.length} clients.`,
      totalClients: oauthClients.length,
      deletedClients: deletedCount,
      failedDeletions: oauthClients.length - deletedCount,
      results: deleteResults,
      nextDeploymentNote: 'Next deployment will create fresh OAuth clients automatically'
    };
    
    console.log('✅ API: OAuth client cleanup completed:', summary);
    
    return NextResponse.json(summary);

  } catch (error: any) {
    console.error('❌ API: Error during OAuth client cleanup:', error);
    
    return NextResponse.json({ 
      error: `OAuth client cleanup failed: ${error.message}`,
      details: error
    }, { status: 500 });
  }
}

/**
 * GET endpoint to list all OAuth 2.0 clients in the project
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

    console.log('🔍 API: Listing OAuth clients for project:', projectId);

    // List all OAuth clients
    const oauthClients = await GoogleOAuthClientManager.listOAuthClients(projectId);
    
    const clientDetails = oauthClients.map(client => ({
      name: client.name,
      displayName: client.displayName,
      clientId: client.clientId,
      creationTime: client.creationTime,
      lastModifiedTime: client.lastModifiedTime
    }));
    
    // Analyze for auto-created clients
    const autoCreatedClients = clientDetails.filter(client => 
      client.displayName?.includes('auto created by Google Service') ||
      client.displayName?.includes('Web client')
    );
    
    return NextResponse.json({
      success: true,
      projectId,
      totalClients: oauthClients.length,
      autoCreatedClients: autoCreatedClients.length,
      recommendation: autoCreatedClients.length > 1 ? 
        `Found ${autoCreatedClients.length} auto-created OAuth clients. Consider cleaning up to prevent accumulation.` :
        'OAuth client count looks normal.',
      clients: clientDetails,
      autoCreatedOnly: autoCreatedClients
    });

  } catch (error: any) {
    console.error('❌ API: Error listing OAuth clients:', error);
    
    return NextResponse.json({ 
      error: `Failed to list OAuth clients: ${error.message}` 
    }, { status: 500 });
  }
}