// src/services/firebaseAuthorizedDomainsService.ts

export class FirebaseAuthorizedDomainsService {
  private static readonly API_BASE = 'https://identitytoolkit.googleapis.com/admin/v2';
  
  private static async getAccessToken(): Promise<string> {
    const { GoogleAuth } = require('google-auth-library');
    
    const auth = new GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/firebase',
        'https://www.googleapis.com/auth/identitytoolkit'
      ],
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token!;
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