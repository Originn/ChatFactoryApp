import { getAuthClient } from '@/lib/gcp-auth';
import { google } from 'googleapis';

export interface PoolServiceAccount {
  clientEmail: string;
  privateKey: string;
  projectId: string;
}

/**
 * Service for securely retrieving pool project service account credentials
 * from Google Secret Manager at runtime
 */
export class PoolCredentialsService {
  private static cache = new Map<string, PoolServiceAccount>();

  /**
   * Get service account credentials for a specific pool project
   * @param poolProjectId - The pool project ID (e.g., 'chatfactory-pool-001')
   * @returns Promise<PoolServiceAccount>
   */
  static async getPoolServiceAccount(poolProjectId: string): Promise<PoolServiceAccount> {
    // Check cache first
    if (this.cache.has(poolProjectId)) {
      console.log(`🔄 Using cached credentials for ${poolProjectId}`);
      return this.cache.get(poolProjectId)!;
    }

    try {
      console.log(`🔐 Retrieving service account credentials for ${poolProjectId}...`);

      const authClient = await getAuthClient();
      const secretManager = google.secretmanager('v1');

      // Extract pool number (e.g., '001' from 'chatfactory-pool-001')
      const poolNumber = poolProjectId.split('-').pop();
      if (!poolNumber) {
        throw new Error(`Invalid pool project ID format: ${poolProjectId}`);
      }

      const centralProjectId = process.env.FIREBASE_PROJECT_ID || 'docsai-chatbot-app';

      // Secret names in the central project
      const clientEmailSecret = `projects/${centralProjectId}/secrets/pool-${poolNumber}-client-email/versions/latest`;
      const privateKeySecret = `projects/${centralProjectId}/secrets/pool-${poolNumber}-private-key/versions/latest`;

      console.log(`🔍 Fetching secrets: pool-${poolNumber}-client-email, pool-${poolNumber}-private-key`);

      // Retrieve both secrets in parallel
      const [clientEmailResponse, privateKeyResponse] = await Promise.all([
        secretManager.projects.secrets.versions.access({
          name: clientEmailSecret,
          auth: authClient
        }),
        secretManager.projects.secrets.versions.access({
          name: privateKeySecret,
          auth: authClient
        })
      ]);

      // Decode the secrets
      const clientEmail = Buffer.from(
        clientEmailResponse.data.payload?.data || '',
        'base64'
      ).toString().trim();

      const privateKey = Buffer.from(
        privateKeyResponse.data.payload?.data || '',
        'base64'
      ).toString().trim();

      if (!clientEmail || !privateKey) {
        throw new Error(`Missing credentials for ${poolProjectId}`);
      }

      const serviceAccount: PoolServiceAccount = {
        clientEmail,
        privateKey,
        projectId: poolProjectId
      };

      // Cache for future use (with TTL if needed)
      this.cache.set(poolProjectId, serviceAccount);

      console.log(`✅ Retrieved credentials for ${poolProjectId}: ${clientEmail}`);

      return serviceAccount;

    } catch (error: any) {
      console.error(`❌ Failed to retrieve credentials for ${poolProjectId}:`, error.message);
      throw new Error(`Failed to get service account for ${poolProjectId}: ${error.message}`);
    }
  }

  /**
   * Clear cached credentials (useful for testing or credential rotation)
   */
  static clearCache(): void {
    this.cache.clear();
    console.log('🔄 Cleared pool credentials cache');
  }

  /**
   * Get all available pool project IDs (001-009)
   */
  static getPoolProjectIds(): string[] {
    return Array.from({ length: 9 }, (_, i) =>
      `chatfactory-pool-${String(i + 1).padStart(3, '0')}`
    );
  }
}