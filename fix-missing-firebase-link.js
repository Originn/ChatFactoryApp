/**
 * Fix Missing Firebase Project Link
 * =================================
 *
 * This script fixes chatbots that have AuraDB instances but are missing
 * the firebaseProjectId link in their Firestore document.
 */

// Load environment variables manually
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...value] = line.split('=');
      if (key && value.length) {
        process.env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
    console.log('✅ Loaded .env.local');
  }
} catch (error) {
  console.log('⚠️ Could not load .env.local:', error.message);
}

// Firebase Admin setup
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const serviceAccount = {
  type: "service_account",
  project_id: process.env.CHATFACTORY_MAIN_PROJECT_ID,
  private_key_id: "dummy",
  private_key: process.env.CHATFACTORY_MAIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.CHATFACTORY_MAIN_CLIENT_EMAIL,
  client_id: "dummy",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs"
};

const app = initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore(app);

async function fixMissingFirebaseLink() {
  console.log('🔧 Fixing Missing Firebase Project Link\n');

  const CHATBOT_ID = 'yXwPtX5nWPwX6edSgYdq';
  const FIREBASE_PROJECT_ID = 'my-dev-chatbot-firebase';

  try {
    // Step 1: Check current chatbot document
    console.log('1️⃣ Checking current chatbot document...');
    const chatbotRef = db.collection('chatbots').doc(CHATBOT_ID);
    const chatbotSnap = await chatbotRef.get();

    if (!chatbotSnap.exists) {
      console.log('❌ Chatbot not found:', CHATBOT_ID);
      return;
    }

    const chatbotData = chatbotSnap.data();
    console.log('📋 Current chatbot fields:', Object.keys(chatbotData));
    console.log('🔗 Current firebaseProjectId:', chatbotData.firebaseProjectId || 'MISSING');

    // Step 2: Check Firebase project exists
    console.log('\n2️⃣ Verifying Firebase project exists...');
    const projectRef = db.collection('firebaseProjects').doc(FIREBASE_PROJECT_ID);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      console.log('❌ Firebase project not found:', FIREBASE_PROJECT_ID);
      return;
    }

    const projectData = projectSnap.data();
    console.log('✅ Firebase project found');
    console.log('📋 Project fields:', Object.keys(projectData));
    console.log('🗄️ Has neo4jInstance:', !!projectData.neo4jInstance);

    if (projectData.neo4jInstance) {
      console.log('📊 AuraDB instance details:');
      console.log(`   Instance ID: ${projectData.neo4jInstance.instanceId}`);
      console.log(`   Instance Name: ${projectData.neo4jInstance.instanceName}`);
      console.log(`   Status: ${projectData.neo4jInstance.status}`);
      console.log(`   URI: ${projectData.neo4jInstance.uri}`);
    }

    // Step 3: Add the missing link
    if (!chatbotData.firebaseProjectId) {
      console.log('\n3️⃣ Adding missing firebaseProjectId link...');

      await chatbotRef.update({
        firebaseProjectId: FIREBASE_PROJECT_ID,
        updatedAt: new Date()
      });

      console.log('✅ Successfully added firebaseProjectId to chatbot');
      console.log(`🔗 Linked chatbot ${CHATBOT_ID} to Firebase project ${FIREBASE_PROJECT_ID}`);
    } else {
      console.log('\n3️⃣ firebaseProjectId already exists');
      console.log('🔗 Current link:', chatbotData.firebaseProjectId);

      if (chatbotData.firebaseProjectId !== FIREBASE_PROJECT_ID) {
        console.log('⚠️ Warning: Linked to different project than expected');
        console.log(`   Expected: ${FIREBASE_PROJECT_ID}`);
        console.log(`   Actual: ${chatbotData.firebaseProjectId}`);
      }
    }

    // Step 4: Verify the fix
    console.log('\n4️⃣ Verifying the fix...');
    const updatedSnap = await chatbotRef.get();
    const updatedData = updatedSnap.data();

    if (updatedData.firebaseProjectId === FIREBASE_PROJECT_ID) {
      console.log('✅ Fix verified successfully!');
      console.log('🎉 Chatbot now properly linked to Firebase project');
      console.log('🗄️ AuraDB instance should now be detected correctly');
    } else {
      console.log('❌ Fix verification failed');
    }

  } catch (error) {
    console.error('❌ Error fixing Firebase link:', error);
  }
}

// Run the fix
if (require.main === module) {
  fixMissingFirebaseLink();
}

module.exports = { fixMissingFirebaseLink };