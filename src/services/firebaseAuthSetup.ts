// src/services/firebaseAuthSetup.ts

interface AuthProviderConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
}

interface FirebaseAuthSetup {
  projectId: string;
  googleConfig?: AuthProviderConfig;
  emailPasswordEnabled?: boolean;
}

export class FirebaseAuthConfigService {
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
   * Initialize Firebase Authentication for a project
   */
  static async initializeFirebaseAuth(projectId: string): Promise<boolean> {
    try {
      console.log(`🔧 Initializing Firebase Authentication for project: ${projectId}`);
      const accessToken = await this.getAccessToken();
      
      // First, enable the Identity Toolkit API if not already enabled
      console.log('🔧 Enabling Identity Toolkit API...');
      const enableApiUrl = `https://serviceusage.googleapis.com/v1/projects/${projectId}/services/identitytoolkit.googleapis.com:enable`;
      
      const enableResponse = await fetch(enableApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (enableResponse.ok || enableResponse.status === 400) {
        console.log('✅ Identity Toolkit API enabled');
      } else {
        console.warn('⚠️ Failed to enable Identity Toolkit API, continuing...');
      }

      // Wait for API to be ready
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Now try to get or create the Firebase Authentication configuration
      const configUrl = `${this.API_BASE}/projects/${projectId}/config`;
      
      const configResponse = await fetch(configUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (configResponse.ok) {
        console.log('✅ Firebase Authentication already initialized');
        return true;
      } else if (configResponse.status === 404) {
        console.log('🔧 Firebase Authentication not found, creating initial configuration...');
        
        // Try to create initial Firebase Authentication configuration
        const createConfigUrl = `${this.API_BASE}/projects/${projectId}/config`;
        const createResponse = await fetch(createConfigUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            signIn: {
              allowDuplicateEmails: false,
              anonymous: {
                enabled: false
              },
              email: {
                enabled: true,
                passwordRequired: true
              }
            },
            notification: {
              sendEmail: {
                method: "DEFAULT"
              }
            }
          })
        });

        if (createResponse.ok) {
          console.log('✅ Firebase Authentication initialized successfully');
          // Wait for configuration to propagate
          await new Promise(resolve => setTimeout(resolve, 10000));
          return true;
        } else {
          const error = await createResponse.json();
          console.error('❌ Failed to create Firebase Authentication config:', JSON.stringify(error, null, 2));
          
          // Try alternative initialization method
          console.log('🔧 Trying alternative initialization method...');
          return await this.alternativeAuthInit(projectId, accessToken);
        }
      } else {
        const error = await configResponse.json();
        console.error('❌ Failed to check Firebase Authentication config:', JSON.stringify(error, null, 2));
        return false;
      }
    } catch (error) {
      console.error('❌ Error initializing Firebase Authentication:', error);
      return false;
    }
  }

  /**
   * Alternative Firebase Authentication initialization method
   */
  private static async alternativeAuthInit(projectId: string, accessToken: string): Promise<boolean> {
    try {
      // Try to enable email/password provider directly - this often initializes Firebase Auth
      const providerUrl = `${this.API_BASE}/projects/${projectId}/defaultSupportedIdpConfigs?idpId=password`;
      
      const providerResponse = await fetch(providerUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `projects/${projectId}/defaultSupportedIdpConfigs/password`,
          enabled: true
        })
      });

      if (providerResponse.ok || providerResponse.status === 409) {
        console.log('✅ Firebase Authentication initialized via provider creation');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return true;
      } else {
        const error = await providerResponse.json();
        console.error('❌ Alternative initialization also failed:', JSON.stringify(error, null, 2));
        console.warn('⚠️ Firebase Authentication may need manual initialization');
        console.warn('💡 Go to Firebase Console → Authentication → Sign-in method to initialize');
        return false;
      }
    } catch (error) {
      console.error('❌ Alternative initialization error:', error);
      return false;
    }
  }

  static async enableGoogleProvider(
    projectId: string, 
    clientId: string, 
    clientSecret: string
  ): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      
      const url = `${this.API_BASE}/projects/${projectId}/defaultSupportedIdpConfigs?idpId=google.com`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `projects/${projectId}/defaultSupportedIdpConfigs/google.com`,
          enabled: true,
          clientId,
          clientSecret
        })
      });

      if (response.ok) {
        console.log('✅ Google OAuth provider enabled successfully');
        return true;
      } else if (response.status === 409) {
        console.log('⚠️ Google OAuth provider already exists, updating...');
        return await this.updateGoogleProvider(projectId, clientId, clientSecret);
      } else {
        const errorData = await response.json();
        console.error('❌ Failed to enable Google provider:', JSON.stringify(errorData, null, 2));
        
        // Provide specific guidance for common errors
        if (errorData.error?.code === 404 && errorData.error?.message === 'CONFIGURATION_NOT_FOUND') {
          console.error('💡 This typically means Firebase Authentication is not initialized yet');
          console.error('💡 The initializeFirebaseAuth step should have resolved this');
        }
        
        return false;
      }
    } catch (error) {
      console.error('❌ Error enabling Google provider:', error);
      return false;
    }
  }

  static async updateGoogleProvider(projectId: string, clientId: string, clientSecret: string): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      
      const getUrl = `${this.API_BASE}/projects/${projectId}/defaultSupportedIdpConfigs/google.com`;
      const getResponse = await fetch(getUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!getResponse.ok) return false;

      const currentConfig = await getResponse.json();
      
      const updateUrl = `${this.API_BASE}/${currentConfig.name}`;
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...currentConfig, enabled: true, clientId, clientSecret })
      });

      return updateResponse.ok;
    } catch (error) {
      console.error('❌ Error updating Google provider:', error);
      return false;
    }
  }

  static async enableEmailPasswordProvider(projectId: string): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();      
      const url = `${this.API_BASE}/projects/${projectId}/defaultSupportedIdpConfigs?idpId=password`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: `projects/${projectId}/defaultSupportedIdpConfigs/password`,
          enabled: true
        })
      });

      return response.ok || response.status === 409;
    } catch (error) {
      console.error('❌ Error enabling Email/Password provider:', error);
      return false;
    }
  }

  static async setupAuthenticationForChatbot(config: FirebaseAuthSetup): Promise<boolean> {
    console.log(`🔧 Setting up authentication for project: ${config.projectId}`);
    
    // First, initialize Firebase Authentication for the project
    const authInitialized = await this.initializeFirebaseAuth(config.projectId);
    if (!authInitialized) {
      console.error('❌ Failed to initialize Firebase Authentication');
      return false;
    }
    
    const results: boolean[] = [];

    if (config.emailPasswordEnabled) {
      const emailResult = await this.enableEmailPasswordProvider(config.projectId);
      results.push(emailResult);
    }

    if (config.googleConfig) {
      const googleResult = await this.enableGoogleProvider(
        config.projectId,
        config.googleConfig.clientId,
        config.googleConfig.clientSecret
      );
      results.push(googleResult);
    }

    const allSuccessful = results.every(result => result);
    
    if (allSuccessful) {
      console.log('✅ All authentication providers configured successfully');
    } else {
      console.log('⚠️ Some authentication providers failed to configure');
    }

    return allSuccessful;
  }
}

export type { FirebaseAuthSetup, AuthProviderConfig };
