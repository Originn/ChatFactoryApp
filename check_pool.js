const admin = require('firebase-admin');

// Initialize Firebase Admin if not already initialized  
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkPool() {
  try {
    console.log('🔍 Checking project pool status...');
    
    const snapshot = await db.collection('projectMappings').get();
    
    if (snapshot.empty) {
      console.log('📋 No projects found in pool');
      return;
    }
    
    console.log('📊 Total projects in collection:', snapshot.size);
    
    snapshot.docs.forEach((doc, idx) => {
      const data = doc.data();
      console.log('\n' + (idx + 1) + '. Project ID:', doc.id);
      console.log('   Status:', data.status);
      console.log('   Project Type:', data.projectType);
      console.log('   Chatbot ID:', data.chatbotId || 'none');
      console.log('   User ID:', data.userId || 'none');
      console.log('   Last Used:', data.lastUsedAt ? data.lastUsedAt.toDate() : 'never');
      console.log('   Created:', data.createdAt ? data.createdAt.toDate() : 'unknown');
    });
    
  } catch (error) {
    console.error('❌ Error checking pool:', error);
  }
}

checkPool().then(() => process.exit(0));
