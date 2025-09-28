import { NextResponse } from 'next/server';
import { getAuthClient } from '@/lib/gcp-auth';
import { google } from 'googleapis';

export async function POST() {
  try {
    console.log('🔐 Resetting all pool project secrets to "false"...');

    const poolProjects = ['chatfactory-pool-001', 'chatfactory-pool-002', 'chatfactory-pool-003'];
    const authClient = await getAuthClient();
    const secretManager = google.secretmanager('v1');

    let updatedCount = 0;
    const results = [];

    for (const projectId of poolProjects) {
      try {
        const secretName = `projects/${projectId}/secrets/project-in-use`;

        console.log(`🔐 Updating secret for ${projectId} to "false"`);

        await secretManager.projects.secrets.addVersion({
          parent: secretName,
          auth: authClient,
          requestBody: {
            payload: {
              data: Buffer.from('false').toString('base64')
            }
          }
        });

        console.log(`✅ Updated secret for ${projectId}: false`);
        updatedCount++;
        results.push({ projectId, status: 'success', value: 'false' });

      } catch (error: any) {
        console.error(`❌ Failed to update secret for ${projectId}:`, error.message);
        results.push({ projectId, status: 'error', error: error.message });
      }
    }

    return NextResponse.json({
      message: `Reset ${updatedCount} pool project secrets to "false"`,
      updated: updatedCount,
      results
    });

  } catch (error: any) {
    console.error('❌ Error resetting pool secrets:', error);
    return NextResponse.json(
      { error: 'Failed to reset pool secrets', details: error.message },
      { status: 500 }
    );
  }
}