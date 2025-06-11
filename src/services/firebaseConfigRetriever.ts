/**
 * Firebase Configuration Retriever
 * 
 * Dedicated service for reliably retrieving Firebase configuration from Google Cloud APIs.
 * Implements multiple retry strategies and fallback mechanisms to avoid using invalid API keys.
 */

import { google } from 'googleapis';
import { getAuthClient } from '@/lib/gcp-auth';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface ConfigRetrievalResult {
  success: boolean;
  config?: FirebaseConfig;
  error?: string;
  isValid?: boolean;
  retrievalMethod?: string;
}

export class FirebaseConfigRetriever {
  
  /**
   * Retrieve Firebase configuration with comprehensive retry logic
   */
  static async getFirebaseConfig(
    projectId: string, 
    maxRetries = 8, 
    initialDelayMs = 10000
  ): Promise<ConfigRetrievalResult> {
    console.log(`🔧 Attempting to retrieve Firebase config for project: ${projectId}`);
    
    let lastError: any = null;
    
    // Method 1: Direct web app config retrieval (preferred)
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.getConfigFromWebApp(projectId);
        if (result.success && result.config && this.isValidApiKey(result.config.apiKey)) {
          console.log(`✅ Retrieved valid Firebase config via web app (attempt ${attempt + 1})`);
          return {
            ...result,
            retrievalMethod: `web-app-attempt-${attempt + 1}`
          };
        }
      } catch (error: any) {
        lastError = error;
        console.log(`⏳ Web app config attempt ${attempt + 1}/${maxRetries} failed: ${error.message}`);
        
        if (attempt < maxRetries - 1) {
          const delay = Math.min(initialDelayMs * Math.pow(1.5, attempt), 60000);
          console.log(`   Retrying in ${delay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // Method 2: Try REST API approach
    console.log('🔄 Attempting Firebase config via REST API...');
    try {
      const restResult = await this.getConfigViaRestAPI(projectId);
      if (restResult.success && restResult.config && this.isValidApiKey(restResult.config.apiKey)) {
        console.log('✅ Retrieved valid Firebase config via REST API');
        return {
          ...restResult,
          retrievalMethod: 'rest-api'
        };
      }
    } catch (error: any) {
      console.warn('⚠️ REST API config retrieval failed:', error.message);
      lastError = error;
    }
    
    // Method 3: Try Google Cloud API Key service
    console.log('🔄 Attempting to create new API key via Google Cloud...');
    try {
      const apiKeyResult = await this.createNewApiKey(projectId);
      if (apiKeyResult.success && apiKeyResult.config && this.isValidApiKey(apiKeyResult.config.apiKey)) {
        console.log('✅ Created new valid API key via Google Cloud');
        return {
          ...apiKeyResult,
          retrievalMethod: 'new-api-key'
        };
      }
    } catch (error: any) {
      console.warn('⚠️ New API key creation failed:', error.message);
      lastError = error;
    }
    
    // All methods failed
    console.error('❌ All Firebase config retrieval methods failed');
    return {
      success: false,
      error: `Failed to retrieve valid Firebase config after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`,
      isValid: false
    };
  }
  
  /**
   * Get Firebase config from web app (primary method)
   */
  private static async getConfigFromWebApp(projectId: string): Promise<ConfigRetrievalResult> {
    const authClient = await getAuthClient();
    const firebase = google.firebase('v1beta1');
    
    // List web apps
    const webApps = await firebase.projects.webApps.list({
      parent: `projects/${projectId}`,
      auth: authClient as any
    });
    
    if (!(webApps as any).data.apps || (webApps as any).data.apps.length === 0) {
      throw new Error('No web apps found in Firebase project');
    }
    
    // Get the latest web app
    const latestApp = (webApps as any).data.apps[(webApps as any).data.apps.length - 1];
    
    if (!latestApp.name) {
      throw new Error('Web app name is missing');
    }
    
    // Get web app config
    const configResponse = await firebase.projects.webApps.getConfig({
      name: `${latestApp.name}/config`,
      auth: authClient as any
    });
    
    const configData = (configResponse as any).data;
    
    if (!configData || !configData.apiKey) {
      throw new Error('Config data is missing or incomplete');
    }
    
    const config = this.parseFirebaseConfig(configData, projectId);
    
    return {
      success: true,
      config,
      isValid: this.isValidApiKey(config.apiKey)
    };
  }
  
  /**
   * Get Firebase config via REST API (fallback method)
   */
  private static async getConfigViaRestAPI(projectId: string): Promise<ConfigRetrievalResult> {
    const authClient = await getAuthClient();
    const accessToken = await authClient.getAccessToken();
    
    if (!accessToken) {
      throw new Error('Failed to get access token');
    }
    
    // Try to get project details via REST API
    const response = await fetch(`https://firebase.googleapis.com/v1beta1/projects/${projectId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`REST API request failed: ${response.status} ${response.statusText}`);
    }
    
    const projectData = await response.json();
    
    // This is a simplified approach - in practice, you might need to extract
    // the actual API key from the project data or create one
    if (projectData.projectId) {
      // Try to get existing API keys
      const apiKeysResponse = await fetch(
        `https://apikeys.googleapis.com/v2/projects/${projectData.projectNumber}/locations/global/keys`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (apiKeysResponse.ok) {
        const apiKeysData = await apiKeysResponse.json();
        
        // Look for a Firebase-compatible API key
        const firebaseKey = apiKeysData.keys?.find((key: any) => 
          key.restrictions?.browserKeyRestrictions?.allowedReferrers ||
          key.restrictions?.serverKeyRestrictions ||
          !key.restrictions // Unrestricted key
        );
        
        if (firebaseKey && firebaseKey.keyString) {
          const config: FirebaseConfig = {
            apiKey: firebaseKey.keyString,
            authDomain: `${projectId}.firebaseapp.com`,
            projectId: projectId,
            storageBucket: `${projectId}.appspot.com`,
            messagingSenderId: projectData.projectNumber || 'unknown',
            appId: projectData.projectId || 'unknown'
          };
          
          return {
            success: true,
            config,
            isValid: this.isValidApiKey(config.apiKey)
          };
        }
      }
    }
    
    throw new Error('Could not extract valid Firebase config from REST API');
  }
  
  /**
   * Create a new API key for the project
   */
  private static async createNewApiKey(projectId: string): Promise<ConfigRetrievalResult> {
    const authClient = await getAuthClient();
    const accessToken = await authClient.getAccessToken();
    
    if (!accessToken) {
      throw new Error('Failed to get access token');
    }
    
    // Get project number first
    const projectResponse = await fetch(`https://cloudresourcemanager.googleapis.com/v1/projects/${projectId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken.token}`
      }
    });
    
    if (!projectResponse.ok) {
      throw new Error('Failed to get project details');
    }
    
    const projectData = await projectResponse.json();
    const projectNumber = projectData.projectNumber;
    
    if (!projectNumber) {
      throw new Error('Could not get project number');
    }
    
    // Create new API key
    const createKeyResponse = await fetch(
      `https://apikeys.googleapis.com/v2/projects/${projectNumber}/locations/global/keys`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          displayName: `Firebase Key for ${projectId}`,
          restrictions: {
            browserKeyRestrictions: {
              allowedReferrers: [
                `${projectId}.firebaseapp.com/*`,
                `${projectId}.web.app/*`,
                'localhost/*',
                '*.vercel.app/*'
              ]
            },
            apiTargets: [
              {
                service: 'identitytoolkit.googleapis.com'
              },
              {
                service: 'firebase.googleapis.com'
              }
            ]
          }
        })
      }
    );
    
    if (!createKeyResponse.ok) {
      throw new Error(`Failed to create API key: ${createKeyResponse.status}`);
    }
    
    const keyData = await createKeyResponse.json();
    
    if (!keyData.keyString) {
      throw new Error('API key creation returned no key string');
    }
    
    const config: FirebaseConfig = {
      apiKey: keyData.keyString,
      authDomain: `${projectId}.firebaseapp.com`,
      projectId: projectId,
      storageBucket: `${projectId}.appspot.com`,
      messagingSenderId: projectNumber,
      appId: `firebase-${projectId}`
    };
    
    return {
      success: true,
      config,
      isValid: this.isValidApiKey(config.apiKey)
    };
  }
  
  /**
   * Parse Firebase config from API response
   */
  private static parseFirebaseConfig(configData: any, projectId: string): FirebaseConfig {
    return {
      apiKey: configData.apiKey || '',
      authDomain: configData.authDomain || `${projectId}.firebaseapp.com`,
      projectId: configData.projectId || projectId,
      storageBucket: configData.storageBucket || `${projectId}.appspot.com`,
      messagingSenderId: configData.messagingSenderId || 'unknown',
      appId: configData.appId || 'unknown'
    };
  }
  
  /**
   * Validate if an API key looks valid (basic validation)
   */
  private static isValidApiKey(apiKey: string): boolean {
    if (!apiKey || apiKey === 'configured-via-api' || apiKey === 'unknown') {
      return false;
    }
    
    // Real Firebase API keys start with "AIza" and are typically 39 characters long
    if (!apiKey.startsWith('AIza')) {
      console.warn('⚠️ API key does not have expected Firebase format (should start with "AIza")');
      return false;
    }
    
    if (apiKey.length < 35 || apiKey.length > 45) {
      console.warn(`⚠️ API key length (${apiKey.length}) is outside expected range (35-45 chars)`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Verify API key works by making a test call to Firebase
   */
  static async testApiKey(apiKey: string, projectId: string): Promise<boolean> {
    try {
      // Test the API key by making a simple request to Firebase Auth
      const testResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            localId: ['test-user-id-that-does-not-exist']
          })
        }
      );
      
      // Even if the user doesn't exist, a 200 response means the API key is valid
      // A 400 with "INVALID_KEY" means the key is invalid
      if (testResponse.status === 200) {
        return true;
      }
      
      if (testResponse.status === 400) {
        const errorData = await testResponse.json();
        if (errorData.error?.message?.includes('INVALID_KEY') || 
            errorData.error?.message?.includes('API_KEY_INVALID')) {
          return false;
        }
        // Other 400 errors might be fine (e.g., user not found)
        return true;
      }
      
      // Other status codes are inconclusive
      console.warn(`⚠️ API key test returned status ${testResponse.status}, assuming valid`);
      return true;
      
    } catch (error: any) {
      console.warn('⚠️ API key test failed:', error.message);
      return false;
    }
  }
}
