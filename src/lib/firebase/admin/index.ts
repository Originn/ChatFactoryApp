import admin from 'firebase-admin';
import { getGCPCredentials } from '@/lib/gcp-auth';

// Check if Firebase Admin has already been initialized
if (!admin.apps.length) {
  // Initialize Firebase Admin with credentials
  try {
    const credentials = getGCPCredentials() as any;
    
    if (credentials && credentials.credentials) {
      // Use the same credential pattern as Google Cloud SDK
      admin.initializeApp({
        credential: admin.credential.cert(credentials.credentials),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
      console.log('✅ Firebase Admin initialized with unified service account credentials');
    } else {
      // No credentials found - use default (will likely fail in production)
      admin.initializeApp({
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
      console.warn('⚠️ Firebase Admin initialized without explicit credentials - may fail in production');
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
  }
}

// Export the admin instances
export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
export const adminStorage = admin.storage();
