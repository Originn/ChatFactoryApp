/**
 * Direct Firebase Config Retrieval Fix
 * 
 * This fixes the API key retrieval issue by using a more direct approach
 * and proper waiting for Firebase services to be ready.
 */

import { google } from 'googleapis';
import { getAuthClient } from '@/lib/gcp-auth';

export class FirebaseConfigFix {
  
  /**
   * Directly retrieve Firebase web app config with proper waiting
   */
  static async getFirebaseWebAppConfig(projectId: string): Promise<any> {
    const authClient = await getAuthClient();
    const firebase = google.firebase('v1beta1');
    
    console.log('🔧 Getting Firebase web app config for project:', projectId);
    
    // Step 1: Wait for Firebase to be fully ready (critical!)
    await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds
    
    // Step 2: List web apps in the project
    const webAppsResponse = await firebase.projects.webApps.list({
      parent: `projects/${projectId}`,
      auth: authClient as any
    });
    
    const webApps = (webAppsResponse as any).data.apps;
    if (!webApps || webApps.length === 0) {
      throw new Error('No web apps found in Firebase project');
    }
    
    console.log(`📱 Found ${webApps.length} web app(s), getting config...`);
    
    // Step 3: Get config from the first (or latest) web app
    const targetApp = webApps[webApps.length - 1]; // Use latest app
    
    // Step 4: Retry config retrieval with exponential backoff
    const maxRetries = 5;
    let lastError: any = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`🔄 Config retrieval attempt ${attempt + 1}/${maxRetries}...`);
        
        const configResponse = await firebase.projects.webApps.getConfig({
          name: `${targetApp.name}/config`,
          auth: authClient as any
        });
        
        const configData = (configResponse as any).data;
        
        // Validate the config
        if (!configData?.apiKey) {
          throw new Error('Config retrieved but missing API key');
        }
        
        if (!configData.apiKey.startsWith('AIza')) {
          throw new Error(`Invalid API key format: ${configData.apiKey}`);
        }
        
        console.log('✅ Successfully retrieved Firebase config');
        console.log('🔑 API Key:', configData.apiKey.substring(0, 20) + '...');
        console.log('🌐 Auth Domain:', configData.authDomain);
        
        return {
          apiKey: configData.apiKey,
          authDomain: configData.authDomain || `${projectId}.firebaseapp.com`,
          projectId: projectId,
          storageBucket: configData.storageBucket || `${projectId}.appspot.com`,
          messagingSenderId: configData.messagingSenderId || 'unknown',
          appId: configData.appId || 'unknown'
        };
        
      } catch (error: any) {
        lastError = error;
        console.log(`⚠️ Attempt ${attempt + 1} failed: ${error.message}`);
        
        if (attempt < maxRetries - 1) {
          const delay = Math.pow(2, attempt) * 10000; // 10s, 20s, 40s, 80s
          console.log(`   Waiting ${delay/1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If all retries failed, throw the last error
    throw new Error(`Failed to retrieve Firebase config after ${maxRetries} attempts: ${lastError?.message}`);
  }
  
  /**
   * Test if an API key actually works
   */
  static async testApiKeyWorks(apiKey: string, projectId: string): Promise<boolean> {
    try {
      console.log('🧪 Testing API key functionality...');
      
      // Make a simple request to Firebase Auth API
      const testResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ localId: ['test-non-existent-user'] })
        }
      );
      
      if (testResponse.status === 200) {
        console.log('✅ API key test passed (200 response)');
        return true;
      }
      
      if (testResponse.status === 400) {
        const errorData = await testResponse.json();
        if (errorData.error?.message?.includes('API_KEY_INVALID') || 
            errorData.error?.message?.includes('INVALID_KEY')) {
          console.log('❌ API key test failed (invalid key)');
          return false;
        }
        // Other 400 errors are fine (like user not found)
        console.log('✅ API key test passed (valid 400 response)');
        return true;
      }
      
      // Assume valid for other status codes
      console.log(`✅ API key test passed (status ${testResponse.status})`);
      return true;
      
    } catch (error: any) {
      console.warn('⚠️ API key test error:', error.message);
      return false; // Assume invalid on error
    }
  }
}
