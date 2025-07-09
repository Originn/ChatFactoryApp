// DEBUG: Simple script to make chatbot-document-images bucket public
const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// Simple .env.local parser
function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && key.trim() && !key.startsWith('#')) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        process.env[key.trim()] = value;
      }
    });
  } catch (error) {
    console.warn('Could not load .env.local file:', error.message);
  }
}

async function makeBucketPublic() {
  try {
    loadEnvFile();
    
    console.log('🚀 Making chatbot-document-images bucket public...');
    
    const projectId = process.env.REUSABLE_FIREBASE_PROJECT_ID;
    if (!projectId) {
      console.error('❌ REUSABLE_FIREBASE_PROJECT_ID not found in environment variables');
      return;
    }

    const bucketName = `${projectId}-chatbot-document-images`;
    console.log(`🎯 Target bucket: ${bucketName}`);

    // Initialize storage client
    const storage = new Storage({
      projectId: projectId,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    const bucket = storage.bucket(bucketName);
    
    // Check if bucket exists
    const [exists] = await bucket.exists();
    if (!exists) {
      console.error(`❌ Bucket ${bucketName} does not exist in project ${projectId}`);
      return;
    }

    // Check current IAM policy
    const [policy] = await bucket.iam.getPolicy({ requestedPolicyVersion: 3 });
    
    // Check if already public
    const isAlreadyPublic = policy.bindings.some(binding => 
      binding.role === 'roles/storage.objectViewer' && 
      binding.members?.includes('allUsers')
    );

    if (isAlreadyPublic) {
      console.log(`✅ Bucket ${bucketName} is already publicly accessible`);
      return;
    }

    // Add public read access
    policy.bindings.push({
      role: 'roles/storage.objectViewer',
      members: ['allUsers']
    });

    await bucket.iam.setPolicy(policy);
    console.log(`✅ Made GCS bucket ${bucketName} publicly accessible`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

makeBucketPublic();