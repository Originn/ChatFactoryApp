import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

export class SecretManagerService {
  private static client: SecretManagerServiceClient | null = null;

  private static getClient(): SecretManagerServiceClient {
    if (!this.client) {
      this.client = new SecretManagerServiceClient({
        projectId: 'docsai-chatbot-app'
      });
    }
    return this.client;
  }

  /**
   * Get a secret value from Google Cloud Secret Manager
   */
  static async getSecret(secretName: string, projectId: string = 'docsai-chatbot-app'): Promise<string | null> {
    try {
      const client = this.getClient();
      const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;

      const [version] = await client.accessSecretVersion({
        name: name
      });

      const payload = version.payload?.data;
      if (payload) {
        return payload.toString();
      }

      return null;
    } catch (error) {
      console.error(`❌ Error accessing secret ${secretName}:`, error);
      return null;
    }
  }

  /**
   * Get the pool Firebase API key specifically
   */
  static async getPoolFirebaseApiKey(): Promise<string | null> {
    return this.getSecret('POOL_FIREBASE_API_KEY');
  }
}