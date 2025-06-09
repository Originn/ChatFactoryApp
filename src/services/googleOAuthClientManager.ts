
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
      const updateUrl = `${this.IAM_API_BASE}/projects/${projectId}/locations/global/oauthClients/${oauthClientId}`;
      
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
      const deleteUrl = `${this.IAM_API_BASE}/projects/${projectId}/locations/global/oauthClients/${oauthClientId}`;
      
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
      const listUrl = `${this.IAM_API_BASE}/projects/${projectId}/locations/global/oauthClients`;
      
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

export type { OAuthClientConfig, OAuthClientCredential };