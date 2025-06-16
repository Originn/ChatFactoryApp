// src/services/googleOAuthConsentScreenService.ts

export class GoogleOAuthConsentScreenService {
  private static async getAccessToken(): Promise<string> {
    const { GoogleAuth } = require('google-auth-library');
    
    const auth = new GoogleAuth({
      scopes: [
        'https://www.googleapis.com/auth/cloud-platform'
      ],
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    return tokenResponse.token!;
  }

  /**
   * Configure OAuth consent screen for external users (simplified)
   */
  static async configureExternalConsentScreen(projectId: string, appName: string): Promise<boolean> {
    try {
      console.log(`🔧 Configuring OAuth consent screen for external users: ${projectId}`);
      
      // For now, automatic configuration is complex and unreliable
      // Most Google Cloud APIs for OAuth configuration require manual setup
      console.log('⚠️  Automatic OAuth consent screen configuration not available');
      console.log('📋 Manual setup required:');
      console.log(this.getManualSetupInstructions(projectId, appName));
      
      return false; // Always return false to indicate manual setup needed
      
    } catch (error) {
      console.error('❌ Error in OAuth consent screen service:', error);
      return false;
    }
  }

  /**
   * Provide manual setup instructions
   */
  static getManualSetupInstructions(projectId: string, appName: string): string {
    return `
🔧 MANUAL OAUTH SETUP REQUIRED FOR OPEN SIGNUP:

1. Go to: https://console.cloud.google.com/apis/credentials/consent?project=${projectId}
2. User Type: Select "External" ✅ (IMPORTANT!)
3. App Name: ${appName}
4. Support Email: Your email address
5. Save and Continue through all steps
6. Publish App for public access

⚠️ IMPORTANT: User Type MUST be "External" for Open Signup to work!

🔄 After setup, Google sign-in will work for all users.
`;
  }

  /**
   * Get the direct link to OAuth consent screen for a project
   */
  static getOAuthConsentScreenUrl(projectId: string): string {
    return `https://console.cloud.google.com/apis/credentials/consent?project=${projectId}`;
  }
}
