import { NextResponse } from 'next/server';
import { getAuthClient } from '@/lib/gcp-auth';
import { google } from 'googleapis';

export async function POST() {
  try {
    console.log('🔄 Auto-downloading service account keys from pool projects...');

    const authClient = await getAuthClient();
    const iam = google.iam('v1');
    const secretManager = google.secretmanager('v1');

    // Pool projects 001-009
    const poolProjects = Array.from({ length: 9 }, (_, i) =>
      `chatfactory-pool-${String(i + 1).padStart(3, '0')}`
    );

    const results = [];
    let successCount = 0;

    for (const poolProjectId of poolProjects) {
      try {
        console.log(`\n🔑 Processing ${poolProjectId}...`);

        // Service account email for this pool project
        const serviceAccountEmail = `chatbot-service-account@${poolProjectId}.iam.gserviceaccount.com`;

        console.log(`📥 Downloading key for: ${serviceAccountEmail}`);

        // Download the service account key from the pool project
        const keyResponse = await iam.projects.serviceAccounts.keys.create({
          name: `projects/${poolProjectId}/serviceAccounts/${serviceAccountEmail}`,
          auth: authClient,
          requestBody: {
            keyAlgorithm: 'KEY_ALG_RSA_2048',
            privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE'
          }
        });

        if (!keyResponse.data.privateKeyData) {
          throw new Error('No private key data returned');
        }

        // Decode the key (it's base64 encoded)
        const keyData = JSON.parse(
          Buffer.from(keyResponse.data.privateKeyData, 'base64').toString()
        );

        console.log(`✅ Downloaded key for ${poolProjectId}: ${keyData.client_email}`);

        // Store in Secret Manager
        const poolNumber = poolProjectId.split('-')[2]; // '001', '002', etc.
        const centralProjectId = process.env.FIREBASE_PROJECT_ID || 'docsai-chatbot-app';

        // Store client email
        await createOrUpdateSecret(
          secretManager,
          authClient,
          centralProjectId,
          `pool-${poolNumber}-client-email`,
          keyData.client_email
        );

        // Store private key
        await createOrUpdateSecret(
          secretManager,
          authClient,
          centralProjectId,
          `pool-${poolNumber}-private-key`,
          keyData.private_key
        );

        console.log(`🔐 Stored secrets for ${poolProjectId} in Secret Manager`);
        successCount++;

        results.push({
          poolProjectId,
          serviceAccountEmail: keyData.client_email,
          status: 'success',
          keyId: keyResponse.data.name,
          secrets: {
            clientEmail: `pool-${poolNumber}-client-email`,
            privateKey: `pool-${poolNumber}-private-key`
          }
        });

      } catch (error: any) {
        console.error(`❌ Failed to process ${poolProjectId}:`, error.message);
        results.push({
          poolProjectId,
          status: 'error',
          error: error.message
        });

        // Continue with next project even if one fails
        continue;
      }
    }

    return NextResponse.json({
      message: `Successfully processed ${successCount}/${poolProjects.length} pool projects`,
      success: successCount,
      total: poolProjects.length,
      results,
      note: 'Service account keys automatically downloaded from pool projects and stored in Secret Manager'
    });

  } catch (error: any) {
    console.error('❌ Error auto-downloading pool keys:', error);
    return NextResponse.json(
      { error: 'Failed to auto-download pool keys', details: error.message },
      { status: 500 }
    );
  }
}

async function createOrUpdateSecret(
  secretManager: any,
  authClient: any,
  projectId: string,
  secretName: string,
  secretValue: string
) {
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

  console.log(`✅ Stored value in secret: ${secretName}`);
}