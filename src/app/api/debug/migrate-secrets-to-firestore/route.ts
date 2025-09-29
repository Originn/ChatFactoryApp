import { NextResponse } from 'next/server';
import { FirestoreSecretService } from '@/services/firestoreSecretService';
import { SecretManagerService } from '@/services/secretManagerService';
import { google } from 'googleapis';
import { getAuthClient } from '@/lib/gcp-auth';

export async function POST() {
  try {
    console.log('🚀 Starting migration from Secret Manager to Firestore...');

    const centralProjectId = process.env.FIREBASE_PROJECT_ID || 'docsai-chatbot-app';
    console.log(`📋 Migrating secrets from project: ${centralProjectId}`);

    // Get all secrets from Secret Manager
    const authClient = await getAuthClient();
    const secretManager = google.secretmanager('v1');

    const listResponse = await secretManager.projects.secrets.list({
      parent: `projects/${centralProjectId}`,
      auth: authClient
    });

    const secrets = listResponse.data.secrets || [];
    console.log(`🔍 Found ${secrets.length} secrets in Secret Manager`);

    const results = {
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[]
    };

    // Migrate each secret
    for (const secret of secrets) {
      const secretName = secret.name?.split('/').pop();
      if (!secretName) {
        console.warn('⚠️ Skipping secret with invalid name format');
        results.skipped++;
        continue;
      }

      try {
        console.log(`🔄 Processing secret: ${secretName}`);

        // Check if secret already exists in Firestore
        const existsInFirestore = await FirestoreSecretService.secretExists(secretName);
        if (existsInFirestore) {
          console.log(`ℹ️ Secret ${secretName} already exists in Firestore, skipping`);
          results.skipped++;
          continue;
        }

        // Get secret value from Secret Manager
        const secretValue = await SecretManagerService.getSecret(secretName, centralProjectId);
        if (!secretValue) {
          console.error(`❌ Could not retrieve value for secret: ${secretName}`);
          results.failed++;
          results.errors.push(`Failed to retrieve value for ${secretName}`);
          continue;
        }

        // Determine secret type and metadata
        let secretType: 'api_key' | 'service_account_email' | 'service_account_key' = 'api_key';
        let poolId: string | undefined = undefined;

        if (secretName.includes('client-email')) {
          secretType = 'service_account_email';
          const poolMatch = secretName.match(/pool-(\d{3})-client-email/);
          poolId = poolMatch ? poolMatch[1] : undefined;
        } else if (secretName.includes('private-key')) {
          secretType = 'service_account_key';
          const poolMatch = secretName.match(/pool-(\d{3})-private-key/);
          poolId = poolMatch ? poolMatch[1] : undefined;
        }

        const description = secretType === 'api_key'
          ? `${secretName.replace('_', ' ')} for application services`
          : `Pool ${poolId} service account ${secretType.replace('service_account_', '')}`;

        // Store in Firestore
        await FirestoreSecretService.setSecret(secretName, secretValue, {
          type: secretType,
          poolId,
          description
        });

        console.log(`✅ Migrated secret: ${secretName} (type: ${secretType})`);
        results.success++;

      } catch (error: any) {
        console.error(`❌ Failed to migrate secret ${secretName}:`, error.message);
        results.failed++;
        results.errors.push(`Failed to migrate ${secretName}: ${error.message}`);
      }
    }

    console.log('📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${results.success}`);
    console.log(`⏭️ Skipped (already exist): ${results.skipped}`);
    console.log(`❌ Failed: ${results.failed}`);

    if (results.errors.length > 0) {
      console.log('🔍 Errors encountered:');
      results.errors.forEach(error => console.log(`  - ${error}`));
    }

    const totalProcessed = results.success + results.skipped + results.failed;
    const migrationComplete = results.failed === 0 && totalProcessed === secrets.length;

    return NextResponse.json({
      success: migrationComplete,
      message: migrationComplete
        ? `Successfully migrated all secrets from Secret Manager to Firestore`
        : `Migration completed with ${results.failed} failures`,
      results: {
        totalSecrets: secrets.length,
        migrated: results.success,
        skipped: results.skipped,
        failed: results.failed,
        errors: results.errors
      },
      costSavings: {
        secretManagerMonthlyCost: secrets.length * 0.06,
        firestoreMonthlyCost: 0.00,
        monthlySavings: secrets.length * 0.06
      }
    });

  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Migration failed',
        details: error.message
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    console.log('🔍 Checking migration status...');

    // Count secrets in Secret Manager
    const centralProjectId = process.env.FIREBASE_PROJECT_ID || 'docsai-chatbot-app';
    const authClient = await getAuthClient();
    const secretManager = google.secretmanager('v1');

    const listResponse = await secretManager.projects.secrets.list({
      parent: `projects/${centralProjectId}`,
      auth: authClient
    });

    const secretManagerSecrets = listResponse.data.secrets || [];

    // Count secrets in Firestore
    const firestoreSecrets = await FirestoreSecretService.listSecrets();

    // Analyze which secrets exist where
    const secretManagerNames = secretManagerSecrets.map(s => s.name?.split('/').pop()).filter(Boolean);
    const onlyInSecretManager = secretManagerNames.filter(name => !firestoreSecrets.includes(name!));
    const onlyInFirestore = firestoreSecrets.filter(name => !secretManagerNames.includes(name));
    const inBoth = secretManagerNames.filter(name => firestoreSecrets.includes(name!));

    const migrationStatus = {
      secretManager: {
        total: secretManagerSecrets.length,
        secrets: secretManagerNames
      },
      firestore: {
        total: firestoreSecrets.length,
        secrets: firestoreSecrets
      },
      analysis: {
        inBoth: inBoth.length,
        onlyInSecretManager: onlyInSecretManager.length,
        onlyInFirestore: onlyInFirestore.length,
        migrationComplete: onlyInSecretManager.length === 0
      },
      costAnalysis: {
        currentSecretManagerCost: secretManagerSecrets.length * 0.06,
        projectedFirestoreCost: 0.00,
        potentialMonthlySavings: secretManagerSecrets.length * 0.06
      }
    };

    return NextResponse.json({
      success: true,
      status: migrationStatus
    });

  } catch (error: any) {
    console.error('❌ Status check failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Status check failed',
        details: error.message
      },
      { status: 500 }
    );
  }
}