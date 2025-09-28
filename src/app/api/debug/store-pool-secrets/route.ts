import { NextResponse } from 'next/server';
import { getAuthClient } from '@/lib/gcp-auth';
import { google } from 'googleapis';

export async function POST() {
  try {
    console.log('🔐 Storing pool project service account keys in Secret Manager...');

    const authClient = await getAuthClient();
    const secretManager = google.secretmanager('v1');

    // Pool projects 001-009
    const poolProjects = Array.from({ length: 9 }, (_, i) =>
      `chatfactory-pool-${String(i + 1).padStart(3, '0')}`
    );

    const results = [];
    let successCount = 0;

    for (const projectId of poolProjects) {
      try {
        console.log(`🔑 Processing ${projectId}...`);

        // Secret names for this project
        const secrets = {
          clientEmail: `pool-${projectId.split('-')[2]}-client-email`,
          privateKey: `pool-${projectId.split('-')[2]}-private-key`
        };

        // Sample credentials (you'll need to replace these with real ones)
        const serviceAccountData = {
          client_email: `chatbot-service-account@${projectId}.iam.gserviceaccount.com`,
          private_key: `-----BEGIN PRIVATE KEY-----\nSAMPLE_KEY_FOR_${projectId.toUpperCase()}_REPLACE_WITH_REAL_KEY\n-----END PRIVATE KEY-----\n`
        };

        // Store client email secret
        await createOrUpdateSecret(secretManager, authClient, secrets.clientEmail, serviceAccountData.client_email);

        // Store private key secret
        await createOrUpdateSecret(secretManager, authClient, secrets.privateKey, serviceAccountData.private_key);

        console.log(`✅ Stored secrets for ${projectId}`);
        successCount++;

        results.push({
          projectId,
          status: 'success',
          secrets: {
            clientEmail: secrets.clientEmail,
            privateKey: secrets.privateKey
          }
        });

      } catch (error: any) {
        console.error(`❌ Failed to store secrets for ${projectId}:`, error.message);
        results.push({
          projectId,
          status: 'error',
          error: error.message
        });
      }
    }

    return NextResponse.json({
      message: `Stored service account secrets for ${successCount}/${poolProjects.length} pool projects`,
      success: successCount,
      total: poolProjects.length,
      results,
      note: 'IMPORTANT: Replace sample keys with real service account keys from each pool project'
    });

  } catch (error: any) {
    console.error('❌ Error storing pool secrets:', error);
    return NextResponse.json(
      { error: 'Failed to store pool secrets', details: error.message },
      { status: 500 }
    );
  }
}

async function createOrUpdateSecret(secretManager: any, authClient: any, secretName: string, secretValue: string) {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'docsai-chatbot-app';
  const fullSecretName = `projects/${projectId}/secrets/${secretName}`;

  try {
    // Try to create the secret first
    await secretManager.projects.secrets.create({
      parent: `projects/${projectId}`,
      secretId: secretName,
      auth: authClient,
      requestBody: {
        replication: {
          automatic: {}
        }
      }
    });
    console.log(`📝 Created secret: ${secretName}`);
  } catch (error: any) {
    if (error.code !== 409) { // 409 = already exists
      throw error;
    }
    console.log(`📝 Secret already exists: ${secretName}`);
  }

  // Add the secret version
  await secretManager.projects.secrets.addVersion({
    parent: fullSecretName,
    auth: authClient,
    requestBody: {
      payload: {
        data: Buffer.from(secretValue).toString('base64')
      }
    }
  });
}