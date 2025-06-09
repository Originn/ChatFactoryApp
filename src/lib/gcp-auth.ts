// src/lib/gcp-auth.ts
import { GoogleAuth } from 'google-auth-library';

export interface GCPCredentials {
  credentials: {
    client_email: string;
    private_key: string;
    project_id: string;
  };
  projectId: string;
}

/**
 * Get Google Cloud Platform credentials optimized for Vercel deployment
 * Works with environment variables in production and gcloud CLI locally
 */
export function getGCPCredentials(): GCPCredentials | {} {
  // For Vercel/production - use environment variables
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
    return {
      credentials: {
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        project_id: process.env.FIREBASE_PROJECT_ID,
      },
      projectId: process.env.FIREBASE_PROJECT_ID,
    };
  }

  // For local development - use default credentials (gcloud CLI)
  console.log('🔍 Using default credentials for local development');
  return {};
}

/**
 * Get authenticated Google Auth client for advanced operations
 */
export async function getAuthClient() {
  const credentials = getGCPCredentials();
  
  console.log('🔑 Initializing Google Auth client...');
  
  const auth = new GoogleAuth({
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform'
    ],
    ...(credentials && Object.keys(credentials).length > 0 && { credentials: (credentials as GCPCredentials).credentials })
  });

  try {
    const authClient = await auth.getClient();
    console.log('✅ Google Auth client initialized successfully');
    return authClient;
  } catch (authError: any) {
    console.error('❌ Failed to initialize Google Auth client:', authError.message);
    throw new Error(`Authentication failed: ${authError.message}`);
  }
}

/**
 * Helper to get project ID from credentials or environment
 */
export function getProjectId(): string {
  const credentials = getGCPCredentials() as GCPCredentials;
  return credentials?.projectId || process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || '';
}
