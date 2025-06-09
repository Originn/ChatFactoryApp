// src/services/oauthConsentScreenService.ts
import { GoogleAuth } from 'google-auth-library';

export interface OAuthConsentScreenConfig {
  projectId: string;
  applicationTitle: string;
  supportEmail: string;
  skipForNonOrganization?: boolean; // Allow skipping for non-org projects
}

export interface Brand {
  name: string;
  supportEmail: string;
  applicationTitle: string;
  orgInternalOnly: boolean;
}

export class OAuthConsentScreenService {
  private static readonly IAP_API_BASE = 'https://iap.googleapis.com/v1';
  
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

  /**
   * Get Google Cloud credentials configuration
   */
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
   * Get project number from project ID
   */
  private static async getProjectNumber(projectId: string, accessToken: string): Promise<string | null> {
    try {
      const response = await fetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`⚠️ Could not get project number for ${projectId}, using project ID instead`);
        return null;
      }

      const projectData = await response.json();
      return projectData.projectNumber || null;
    } catch (error) {
      console.warn(`⚠️ Error getting project number for ${projectId}:`, error);
      return null;
    }
  }

  /**
   * Create OAuth consent screen (brand) for a project
   */
  static async createOAuthConsentScreen(config: OAuthConsentScreenConfig): Promise<{ success: boolean; brand?: Brand; error?: string }> {
    try {
      console.log(`🎨 Creating OAuth consent screen for project: ${config.projectId}`);
      console.log(`🎨 Application: ${config.applicationTitle}`);
      console.log(`🎨 Support email: ${config.supportEmail}`);
      
      const accessToken = await this.getAccessToken();
      
      // Get project number - IAP API works better with project numbers
      console.log('🔍 Getting project number for IAP API...');
      const projectNumber = await this.getProjectNumber(config.projectId, accessToken);
      let parentIdentifier = projectNumber || config.projectId;
      console.log(`🔍 Using parent identifier: ${parentIdentifier} (${projectNumber ? 'project number' : 'project ID'})`);
      
      // Check if brand already exists
      const existingBrand = await this.getBrand(parentIdentifier, accessToken);
      if (existingBrand) {
        console.log('✅ OAuth consent screen already exists');
        return { success: true, brand: existingBrand };
      }
      
      // Retry logic for API availability
      const maxRetries = 3;
      const retryDelay = 30000; // 30 seconds
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`🎨 Creating OAuth consent screen (attempt ${attempt}/${maxRetries})...`);
        
        try {
          // Create new brand with proper request format
          const createUrl = `${this.IAP_API_BASE}/projects/${parentIdentifier}/brands`;
          
          const requestBody = {
            supportEmail: config.supportEmail,
            applicationTitle: config.applicationTitle
          };
          
          console.log('🔧 Request URL:', createUrl);
          console.log('🔧 Request body:', JSON.stringify(requestBody, null, 2));
          
          const response = await fetch(createUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ API Response Error:', JSON.stringify(errorData, null, 2));
            
            // Check if it's an IAP API not enabled error
            if (errorData.error?.message?.includes('Identity-Aware Proxy API') || 
                errorData.error?.message?.includes('iap.googleapis.com')) {
              
              if (attempt < maxRetries) {
                console.log(`⚠️ IAP API not ready yet (attempt ${attempt}/${maxRetries})`);
                console.log(`⏳ Waiting ${retryDelay/1000} seconds before retry...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue; // Try again
              } else {
                console.error('❌ IAP API still not available after all retries');
                return {
                  success: false,
                  error: `Failed to create OAuth consent screen: Cloud Identity-Aware Proxy API has not been used in project ${config.projectId} before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/iap.googleapis.com/overview?project=${config.projectId} then retry. If you enabled this API recently, wait a few minutes for the action to propagate to our systems and retry.`
                };
              }
            }
            
            // Check for organization requirement error
            if (errorData.error?.message?.includes('organization') || 
                errorData.error?.message?.includes('G Suite') ||
                errorData.error?.message?.includes('Google Workspace')) {
              console.error('❌ Organization requirement error');
              return {
                success: false,
                error: `Failed to create OAuth consent screen: This project must be part of a Google Workspace organization. Please create the project under a Google Workspace organization or set up OAuth consent screen manually at https://console.cloud.google.com/apis/credentials/consent?project=${config.projectId}`
              };
            }
            
            // Check for invalid argument - could be organization requirement
            if (errorData.error?.code === 400 && errorData.error?.message?.includes('invalid argument')) {
              console.error('❌ Invalid argument error - likely organization requirement');
              console.log('🔍 Support email format:', config.supportEmail);
              console.log('🔍 Application title:', config.applicationTitle);
              console.log('🔍 Project identifier:', parentIdentifier);
              
              // Try with project ID if we used project number on first attempt
              if (projectNumber && attempt === 1) {
                console.log('🔄 Retrying with project ID instead of project number...');
                parentIdentifier = config.projectId;
                continue;
              }
              
              // This is likely an organization requirement issue
              console.warn('💡 This error typically indicates the project is not part of a Google Workspace organization');
              console.warn('💡 IAP OAuth consent screens require Google Workspace organization membership');
              console.warn('💡 Firebase Authentication can work without IAP OAuth consent screens');
              
              if (config.skipForNonOrganization) {
                console.log('🔄 Skipping IAP OAuth consent screen creation for non-organization project');
                return {
                  success: false,
                  error: 'SKIP_NON_ORGANIZATION_PROJECT'
                };
              }
              
              return {
                success: false,
                error: `OAuth consent screen requires Google Workspace organization. This project (${config.projectId}) is not part of a Google Workspace organization. For Firebase Authentication to work properly, please either: 1) Create the project under a Google Workspace organization, or 2) Set up OAuth consent screen manually at https://console.cloud.google.com/apis/credentials/consent?project=${config.projectId}. Note: Firebase Authentication can work without IAP OAuth consent screens for most use cases.`
              };
            }
              
              return {
                success: false,
                error: `Failed to create OAuth consent screen: Request contains invalid arguments. This commonly occurs when: 1) The project is not part of a Google Workspace organization, 2) The support email format is invalid, or 3) Required organization permissions are missing. Please verify the project setup and try creating the OAuth consent screen manually at https://console.cloud.google.com/apis/credentials/consent?project=${config.projectId}`
              };
            }
            
            // Other error - don't retry
            console.error('❌ Failed to create OAuth consent screen:', JSON.stringify(errorData, null, 2));
            return {
              success: false,
              error: `Failed to create OAuth consent screen: ${errorData.error?.message || 'Unknown error'}`
            };
          }

          const brand = await response.json();
          console.log('✅ OAuth consent screen created successfully');
          console.log(`🎨 Brand: ${brand.name}`);
          console.log(`🎨 Internal only: ${brand.orgInternalOnly}`);
          
          return { success: true, brand };
          
        } catch (fetchError: any) {
          if (attempt < maxRetries) {
            console.warn(`⚠️ Request failed (attempt ${attempt}/${maxRetries}):`, fetchError.message);
            console.log(`⏳ Waiting ${retryDelay/1000} seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          } else {
            throw fetchError; // Re-throw on final attempt
          }
        }
      }
      
      // This shouldn't be reached, but just in case
      return {
        success: false,
        error: 'Maximum retries exceeded without success'
      };
      
    } catch (error: any) {
      console.error('❌ Error creating OAuth consent screen:', error.message);
      return { 
        success: false, 
        error: `OAuth consent screen creation failed: ${error.message}` 
      };
    }
  }

  /**
   * Get existing brand for a project
   */
  private static async getBrand(parentIdentifier: string, accessToken: string): Promise<Brand | null> {
    try {
      const listUrl = `${this.IAP_API_BASE}/projects/${parentIdentifier}/brands`;
      
      const response = await fetch(listUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) return null;

      const data = await response.json();
      const brands = data.brands || [];
      
      return brands.length > 0 ? brands[0] : null;
      
    } catch (error) {
      console.error('❌ Error getting existing brand:', error);
      return null;
    }
  }
}

export type { OAuthConsentScreenConfig, Brand };
