// src/services/firebaseAuthorizedDomainsService.ts
import { getAuthClient } from '@/lib/gcp-auth';

export class FirebaseAuthorizedDomainsService {
  private static readonly API_BASE = 'https://identitytoolkit.googleapis.com/admin/v2';
  
  private static async getAccessToken(): Promise<string> {
    try {
      const client = await getAuthClient();
      const tokenResponse = await client.getAccessToken();
      return tokenResponse.token!;
    } catch (error) {
      console.error('❌ Failed to get access token for Firebase Auth domains:', error);
      throw error;
    }
  }

  /**
   * Add Vercel deployment domain to Firebase authorized domains
   */
  static async addAuthorizedDomain(projectId: string, domain: string): Promise<boolean> {
    try {
      console.log(`🔧 Adding authorized domain ${domain} to project ${projectId}`);
      const accessToken = await this.getAccessToken();
      
      // Get current configuration
      const configUrl = `${this.API_BASE}/projects/${projectId}/config`;
      const configResponse = await fetch(configUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!configResponse.ok) {
        console.error('❌ Failed to get current config');
        return false;
      }

      const config = await configResponse.json();
      
      // Extract current authorized domains
      const currentDomains = config.authorizedDomains || [];
      
      // Check if domain already exists
      if (currentDomains.includes(domain)) {
        console.log(`✅ Domain ${domain} already authorized`);
        return true;
      }
      
      // Add new domain
      const updatedDomains = [...currentDomains, domain];
      
      // Update configuration
      const updateResponse = await fetch(configUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          authorizedDomains: updatedDomains
        })
      });

      if (updateResponse.ok) {
        console.log(`✅ Successfully added domain ${domain} to authorized domains`);
        return true;
      } else {
        const error = await updateResponse.json();
        console.error('❌ Failed to update authorized domains:', JSON.stringify(error, null, 2));
        return false;
      }
      
    } catch (error) {
      console.error('❌ Error adding authorized domain:', error);
      return false;
    }
  }
  /**
   * Extract domain from Vercel deployment URL
   */
  static extractDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch (error) {
      console.error('❌ Invalid URL:', url);
      return '';
    }
  }

  /**
   * Add multiple Vercel deployment domains
   */
  static async addMultipleAuthorizedDomains(projectId: string, urls: string[]): Promise<boolean> {
    const domains = urls.map(url => this.extractDomainFromUrl(url)).filter(domain => domain);
    
    if (domains.length === 0) {
      console.log('⚠️ No valid domains to add');
      return false;
    }

    console.log(`🔧 Adding ${domains.length} domains to project ${projectId}:`, domains);

    try {
      const accessToken = await this.getAccessToken();
      
      // Get current configuration
      const configUrl = `${this.API_BASE}/projects/${projectId}/config`;
      const configResponse = await fetch(configUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!configResponse.ok) {
        console.error('❌ Failed to get current config');
        return false;
      }

      const config = await configResponse.json();
      const currentDomains = config.authorizedDomains || [];
      
      // Add new domains (avoid duplicates)
      const newDomains = domains.filter(domain => !currentDomains.includes(domain));
      
      if (newDomains.length === 0) {
        console.log('✅ All domains already authorized');
        return true;
      }
      
      const updatedDomains = [...currentDomains, ...newDomains];
      
      // Update configuration
      const updateResponse = await fetch(configUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          authorizedDomains: updatedDomains
        })
      });

      if (updateResponse.ok) {
        console.log(`✅ Successfully added ${newDomains.length} new domains:`, newDomains);
        return true;
      } else {
        const error = await updateResponse.json();
        console.error('❌ Failed to update authorized domains:', JSON.stringify(error, null, 2));
        return false;
      }
      
    } catch (error) {
      console.error('❌ Error adding authorized domains:', error);
      return false;
    }
  }
  /**
   * Ensure Vercel domain is authorized (convenient wrapper)
   */
  static async ensureVercelDomainAuthorized(projectId: string, deploymentUrl: string): Promise<boolean> {
    const domain = this.extractDomainFromUrl(deploymentUrl);
    if (!domain) {
      console.error('❌ Could not extract domain from URL:', deploymentUrl);
      return false;
    }
    
    console.log(`🔧 Ensuring domain ${domain} is authorized for project ${projectId}`);
    return await this.addAuthorizedDomain(projectId, domain);
  }

  /**
   * Ensure both Vercel and custom domains are authorized
   */
  static async ensureDomainsAuthorized(
    projectId: string, 
    vercelUrl: string, 
    customDomain?: string
  ): Promise<{ success: boolean; vercelDomain: boolean; customDomain: boolean }> {
    const result = {
      success: false,
      vercelDomain: false,
      customDomain: false
    };

    // Always authorize the Vercel domain
    result.vercelDomain = await this.ensureVercelDomainAuthorized(projectId, vercelUrl);

    // Authorize custom domain if provided
    if (customDomain) {
      const customDomainUrl = customDomain.startsWith('http') ? customDomain : `https://${customDomain}`;
      result.customDomain = await this.ensureVercelDomainAuthorized(projectId, customDomainUrl);
      console.log(`🔧 Custom domain ${customDomain} authorization: ${result.customDomain ? 'Success' : 'Failed'}`);
    } else {
      result.customDomain = true; // No custom domain to authorize
    }

    result.success = result.vercelDomain && result.customDomain;
    
    console.log(`📊 Domain authorization summary:`, {
      vercelDomain: result.vercelDomain,
      customDomain: customDomain ? result.customDomain : 'N/A',
      overallSuccess: result.success
    });

    return result;
  }

  /**
   * Get list of currently authorized domains for a project
   */
  static async getAuthorizedDomains(projectId: string): Promise<string[]> {
    try {
      const accessToken = await this.getAccessToken();
      
      const configUrl = `${this.API_BASE}/projects/${projectId}/config`;
      const configResponse = await fetch(configUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!configResponse.ok) {
        console.error('❌ Failed to get project config');
        return [];
      }

      const config = await configResponse.json();
      return config.authorizedDomains || [];
      
    } catch (error) {
      console.error('❌ Error getting authorized domains:', error);
      return [];
    }
  }
}

// Usage examples:
// 
// // During chatbot deployment
// const deploymentUrl = 'https://testbot-hvhhcrxg7-ori-somekhs-projects.vercel.app/';
// const projectId = 'your-firebase-project-id';
// 
// await FirebaseAuthorizedDomainsService.addAuthorizedDomain(projectId, 
//   FirebaseAuthorizedDomainsService.extractDomainFromUrl(deploymentUrl)
// );