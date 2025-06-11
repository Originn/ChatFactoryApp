// src/services/firebaseAuthorizedDomainsService.ts
import { GoogleAuth } from 'google-auth-library';

export class FirebaseAuthorizedDomainsService {
  
  /**
   * Add authorized domain to Firebase project using Identity Toolkit API v2
   */
  static async addAuthorizedDomain(projectId: string, domain: string): Promise<boolean> {
    try {
      console.log(`🔧 Attempting to add authorized domain ${domain} to project ${projectId}`);
      
      // Initialize Google Auth
      const auth = new GoogleAuth({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: [
          'https://www.googleapis.com/auth/cloud-platform',
          'https://www.googleapis.com/auth/firebase'
        ]
      });

      const authClient = await auth.getClient();
      const accessToken = await authClient.getAccessToken();

      if (!accessToken.token) {
        throw new Error('Failed to get access token');
      }

      // Use v2 API endpoint (not v1!)
      const baseUrl = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}`;

      // Get current configuration
      console.log(`🔍 Getting current project config from: ${baseUrl}/config`);
      const getConfigResponse = await fetch(`${baseUrl}/config`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!getConfigResponse.ok) {
        const errorText = await getConfigResponse.text();
        console.error(`❌ Failed to get project config: ${getConfigResponse.status} - ${errorText}`);
        return false;
      }

      const currentConfig = await getConfigResponse.json();
      console.log(`✅ Retrieved current config successfully`);
      
      // Check if domain is already authorized
      const currentDomains = currentConfig.authorizedDomains || [];
      if (currentDomains.includes(domain)) {
        console.log(`✅ Domain ${domain} is already authorized`);
        return true;
      }

      // Add the new domain
      const updatedDomains = [...currentDomains, domain];
      console.log(`🔧 Adding domain to list: ${updatedDomains.join(', ')}`);
      
      // Use PATCH with updateMask for v2 API
      const updateResponse = await fetch(`${baseUrl}/config?updateMask=authorizedDomains`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          authorizedDomains: updatedDomains
        })
      });

      if (updateResponse.ok) {
        console.log(`✅ Successfully added authorized domain: ${domain}`);
        return true;
      } else {
        const errorText = await updateResponse.text();
        console.error(`❌ Failed to update authorized domains: ${updateResponse.status} - ${errorText}`);
        return false;
      }

    } catch (error: any) {
      console.error('❌ Error adding authorized domain:', error);
      console.log('💡 Manual action required: Add the domain via Firebase Console');
      console.log(`   1. Go to https://console.firebase.google.com/project/${projectId}/authentication/settings`);
      console.log(`   2. Scroll to "Authorized domains"`);
      console.log(`   3. Click "Add domain" and add: ${domain}`);
      return false;
    }
  }

  /**
   * Get list of currently authorized domains
   */
  static async getAuthorizedDomains(projectId: string): Promise<string[]> {
    try {
      const auth = new GoogleAuth({
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: [
          'https://www.googleapis.com/auth/cloud-platform',
          'https://www.googleapis.com/auth/firebase'
        ]
      });

      const authClient = await auth.getClient();
      const accessToken = await authClient.getAccessToken();

      if (!accessToken.token) {
        throw new Error('Failed to get access token');
      }

      // Use v2 API endpoint
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const config = await response.json();
        console.log(`✅ Retrieved authorized domains: ${config.authorizedDomains?.join(', ') || 'none'}`);
        return config.authorizedDomains || [];
      } else {
        const errorText = await response.text();
        console.error(`❌ Failed to get authorized domains: ${response.status} - ${errorText}`);
        return [];
      }

    } catch (error) {
      console.error('❌ Error getting authorized domains:', error);
      return [];
    }
  }

  /**
   * Automatically add Vercel deployment domain after chatbot deployment
   */
  static async ensureVercelDomainAuthorized(projectId: string, vercelUrl: string): Promise<void> {
    try {
      // Extract domain from Vercel URL
      const domain = vercelUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      
      console.log(`🔍 Checking if domain ${domain} is authorized for project ${projectId}`);
      
      const authorizedDomains = await this.getAuthorizedDomains(projectId);
      
      if (authorizedDomains.includes(domain)) {
        console.log(`✅ Domain ${domain} is already authorized`);
        return;
      }

      console.log(`🔧 Adding domain ${domain} to authorized domains...`);
      const success = await this.addAuthorizedDomain(projectId, domain);
      
      if (!success) {
        console.log(`⚠️  Automatic domain addition failed. Manual action required:`);
        console.log(`   1. Go to https://console.firebase.google.com/project/${projectId}/authentication/settings`);
        console.log(`   2. Scroll to "Authorized domains"`);
        console.log(`   3. Click "Add domain" and add: ${domain}`);
      }

    } catch (error) {
      console.error('❌ Error ensuring Vercel domain is authorized:', error);
    }
  }
}
