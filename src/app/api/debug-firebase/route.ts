import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔍 Debug: Checking Firebase authentication setup...');
    
    // Check environment variables
    const envVars = {
      FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'NOT_SET',
      FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || 'NOT_SET',
      FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY ? 'SET (length: ' + process.env.FIREBASE_PRIVATE_KEY.length + ')' : 'NOT_SET',
      REUSABLE_FIREBASE_PROJECT_ID: process.env.REUSABLE_FIREBASE_PROJECT_ID || 'NOT_SET',
      USE_REUSABLE_FIREBASE_PROJECT: process.env.USE_REUSABLE_FIREBASE_PROJECT || 'NOT_SET',
    };
    
    console.log('📋 Environment variables:', envVars);
    
    // Test Firebase Storage authentication
    const { Storage } = require('@google-cloud/storage');
    
    const credentials = {
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      project_id: process.env.FIREBASE_PROJECT_ID,
    };
    
    console.log('🔑 Credentials check:', {
      client_email: credentials.client_email || 'MISSING',
      private_key: credentials.private_key ? 'SET' : 'MISSING',
      project_id: credentials.project_id || 'MISSING',
    });
    
    // Test authentication to target project
    const firebaseProjectId = process.env.REUSABLE_FIREBASE_PROJECT_ID;
    console.log('🎯 Target project:', firebaseProjectId);
    
    if (!firebaseProjectId) {
      throw new Error('REUSABLE_FIREBASE_PROJECT_ID not set');
    }
    
    const projectSpecificStorage = new Storage({
      projectId: firebaseProjectId,
      credentials: credentials
    });
    
    console.log('🔍 Testing bucket access...');
    
    // Try different bucket patterns
    const bucketPatterns = [
      `${firebaseProjectId}-chatbot-documents`,
      `${firebaseProjectId}.appspot.com`,
      firebaseProjectId,
      `${firebaseProjectId}-default-rtdb`,
      `${firebaseProjectId}-storage`,
    ];
    
    let accessibleBuckets = [];
    let bucketErrors = [];
    
    for (const bucketName of bucketPatterns) {
      try {
        const bucket = projectSpecificStorage.bucket(bucketName);
        await bucket.getMetadata();
        accessibleBuckets.push(bucketName);
        console.log(`✅ Accessible bucket: ${bucketName}`);
      } catch (error: any) {
        bucketErrors.push({
          bucket: bucketName,
          error: error.message
        });
        console.log(`❌ Bucket ${bucketName} not accessible: ${error.message}`);
      }
    }
    
    // Try listing buckets in the project
    let allBuckets = [];
    try {
      console.log('🔍 Attempting to list all buckets in project...');
      const [buckets] = await projectSpecificStorage.getBuckets();
      allBuckets = buckets.map(bucket => bucket.name);
      console.log('📦 Found buckets:', allBuckets);
    } catch (listError: any) {
      console.log('❌ Failed to list buckets:', listError.message);
    }
    
    return NextResponse.json({
      success: true,
      debug: {
        environment: envVars,
        credentials: {
          client_email: credentials.client_email || 'MISSING',
          private_key_set: !!credentials.private_key,
          project_id: credentials.project_id || 'MISSING',
        },
        target_project: firebaseProjectId,
        accessible_buckets: accessibleBuckets,
        bucket_errors: bucketErrors,
        all_buckets: allBuckets,
      }
    });
    
  } catch (error: any) {
    console.error('🚨 Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}