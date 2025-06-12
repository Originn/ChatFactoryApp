import { GoogleAuth } from 'google-auth-library';

export class GoogleOAuthClientManager {
  // Use the correct API for OAuth client management
  private static readonly OAUTH_API_BASE = 'https://iap.googleapis.com/v1';

  private static async getAccessToken(): Promise<string> {
    const credentials = this.getGoogleCloudCredentials();
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      ...(credentials && { credentials })
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token!;
  }

  private static getGoogleCloudCredentials() {
    // In production (Vercel), use JSON from environment variable
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
      try {
        return JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
      } catch (error) {
        console.error('❌ Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', error);
        return undefined;
      }
    }
    
    // In development, use the file path (if GOOGLE_APPLICATION_CREDENTIALS is set)
    return undefined; // Let the library use default authentication
  }

  /**
   * Update OAuth client redirect URIs
   */
  static async updateRedirectUris(
    projectId: string,
    oauthClientId: string,
    newRedirectUris: string[]
  ): Promise<boolean> {
    try {
      console.log('🔄 Updating OAuth redirect URIs...');
      
      const accessToken = await this.getAccessToken();
      const updateUrl = `${this.OAUTH_API_BASE}/projects/${projectId}/locations/global/oauthClients/${oauthClientId}`;
      
      const response = await fetch(`${updateUrl}?updateMask=allowedRedirectUris`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Goog-User-Project': projectId
        },
        body: JSON.stringify({
          allowedRedirectUris: newRedirectUris
        })
      });

      if (response.ok) {
        console.log('✅ OAuth redirect URIs updated successfully');
        return true;
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to update redirect URIs:', JSON.stringify(errorData, null, 2));
        return false;
      }
    } catch (error: any) {
      console.error('❌ Error updating redirect URIs:', error.message);
      return false;
    }
  }

  /**
   * Delete OAuth client
   */
  static async deleteOAuthClient(projectId: string, oauthClientId: string): Promise<boolean> {
    try {
      console.log('🗑️ Deleting OAuth client...');
      
      const accessToken = await this.getAccessToken();
      const deleteUrl = `${this.OAUTH_API_BASE}/projects/${projectId}/locations/global/oauthClients/${oauthClientId}`;
      
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Goog-User-Project': projectId
        }
      });

      if (response.ok) {
        console.log('✅ OAuth client deleted successfully');
        return true;
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to delete OAuth client:', JSON.stringify(errorData, null, 2));
        return false;
      }
    } catch (error: any) {
      console.error('❌ Error deleting OAuth client:', error.message);
      return false;
    }
  }
  /**
   * List OAuth clients for a project
   */
  static async listOAuthClients(projectId: string): Promise<any[]> {
    try {
      const accessToken = await this.getAccessToken();
      const listUrl = `${this.OAUTH_API_BASE}/projects/${projectId}/locations/global/oauthClients`;
      
      const response = await fetch(listUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Goog-User-Project': projectId
        }
      });

      if (response.ok) {
        const result = await response.json();
        return result.oauthClients || [];
      } else {
        console.error('❌ Failed to list OAuth clients:', await response.text());
        return [];
      }
      
    } catch (error: any) {
      console.error('❌ Error listing OAuth clients:', error.message);
      return [];
    }
  }
}