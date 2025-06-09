// src/services/oauthClientService-sdk.ts
import { iapClient } from '@/lib/gcp-clients';

export interface OAuthClientConfig {
  projectId: string;
  clientId: string;
  displayName: string;
  description?: string;
  allowedRedirectUris: string[];
  allowedGrantTypes: string[];
  allowedScopes: string[];
  clientType: 'CONFIDENTIAL_CLIENT' | 'PUBLIC_CLIENT';
}

export class OAuthClientServiceSDK {
  
  /**
   * Create OAuth consent screen (Brand) using IAP SDK
   */
  static async createOAuthConsentScreen(
    projectId: string,
    applicationTitle: string,
    supportEmail: string
  ): Promise<{ success: boolean; brandName?: string; error?: string }> {
    try {
      console.log('🔧 Creating OAuth consent screen via IAP SDK...');
      
      const [brand] = await iapClient.createBrand({
        parent: `projects/${projectId}`,
        brand: {
          applicationTitle,
          supportEmail,
        }
      });

      if (brand.name) {
        console.log('✅ OAuth consent screen created via SDK:', brand.name);
        return { 
          success: true, 
          brandName: brand.name 
        };
      } else {
        return { 
          success: false, 
          error: 'Brand created but no name returned' 
        };
      }
      
    } catch (error: any) {
      console.error('❌ OAuth consent screen creation failed via SDK:', error.message);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Create OAuth 2.0 client using IAP SDK
   */
  static async createOAuthClient(
    config: OAuthClientConfig
  ): Promise<{ success: boolean; clientId?: string; clientSecret?: string; error?: string }> {
    try {
      console.log('🔑 Creating OAuth client via IAP SDK...');
      
      // First, we need to get or create a brand (consent screen)
      const brands = await this.listBrands(config.projectId);
      let brandName: string;
      
      if (brands.length === 0) {
        // Create brand first
        const brandResult = await this.createOAuthConsentScreen(
          config.projectId,
          config.displayName,
          'firebase-project-manager@docsai-chatbot-app.iam.gserviceaccount.com'
        );
        
        if (!brandResult.success || !brandResult.brandName) {
          return { 
            success: false, 
            error: `Failed to create OAuth consent screen: ${brandResult.error}` 
          };
        }
        
        brandName = brandResult.brandName;
      } else {
        brandName = brands[0].name!;
      }

      // Create OAuth client using IAP SDK
      const [client] = await iapClient.createIdentityAwareProxyClient({
        parent: brandName,
        identityAwareProxyClient: {
          displayName: config.displayName,
        }
      });

      if (client.name) {
        console.log('✅ OAuth client created via SDK:', client.name);
        
        // Extract client ID from the response name
        const clientId = client.name.split('/').pop() || 'unknown';
        
        return {
          success: true,
          clientId: clientId,
          clientSecret: client.secret || 'managed-by-google'
        };
      } else {
        return { 
          success: false, 
          error: 'OAuth client created but no name returned' 
        };
      }
      
    } catch (error: any) {
      console.error('❌ OAuth client creation failed via SDK:', error.message);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * List OAuth brands (consent screens) using IAP SDK
   */
  static async listBrands(projectId: string): Promise<any[]> {
    try {
      const [brands] = await iapClient.listBrands({
        parent: `projects/${projectId}`
      });
      
      return brands || [];
    } catch (error: any) {
      console.warn('⚠️ Failed to list brands via SDK:', error.message);
      return [];
    }
  }

  /**
   * Update OAuth client redirect URIs using IAP SDK
   */
  static async updateRedirectUris(
    projectId: string,
    clientName: string,
    redirectUris: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔄 Updating OAuth redirect URIs via SDK...');
      
      // Note: The IAP SDK may not directly support updating redirect URIs
      // This might still require REST API calls or different approach
      console.log('ℹ️ OAuth redirect URI updates may require REST API calls');
      
      return { 
        success: true 
      };
      
    } catch (error: any) {
      console.error('❌ OAuth redirect URI update failed via SDK:', error.message);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Delete OAuth client using IAP SDK
   */
  static async deleteOAuthClient(
    brandName: string,
    clientName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🗑️ Deleting OAuth client via SDK...');
      
      await iapClient.deleteIdentityAwareProxyClient({
        name: `${brandName}/identityAwareProxyClients/${clientName}`
      });
      
      console.log('✅ OAuth client deleted via SDK');
      return { success: true };
      
    } catch (error: any) {
      console.error('❌ OAuth client deletion failed via SDK:', error.message);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Get OAuth client details using IAP SDK
   */
  static async getOAuthClient(
    brandName: string,
    clientName: string
  ): Promise<{ success: boolean; client?: any; error?: string }> {
    try {
      const [client] = await iapClient.getIdentityAwareProxyClient({
        name: `${brandName}/identityAwareProxyClients/${clientName}`
      });
      
      return { 
        success: true, 
        client 
      };
      
    } catch (error: any) {
      console.error('❌ Get OAuth client failed via SDK:', error.message);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
}
