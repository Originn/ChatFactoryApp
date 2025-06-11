const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

async function debugChatbot() {
  const chatbotId = '6DJG7bKysctU3N4p70Dk';
  
  console.log(`🔍 Debugging chatbot: ${chatbotId}`);
  console.log('==========================================');
  
  try {
    // Check chatbot document
    console.log('\n📋 1. Checking chatbot document...');
    const chatbotRef = db.collection('chatbots').doc(chatbotId);
    const chatbotDoc = await chatbotRef.get();
    
    if (chatbotDoc.exists) {
      const data = chatbotDoc.data();
      console.log('✅ Chatbot found in chatbots collection');
      console.log('   Name:', data.name);
      console.log('   Status:', data.status);
      console.log('   User ID:', data.userId);
      console.log('   Require Auth:', data.requireAuth);
      console.log('   Created:', data.createdAt?.toDate?.());
      console.log('   Deployment URL:', data.deployment?.deploymentUrl || 'Not set');
      console.log('   Vercel Project ID:', data.deployment?.vercelProjectId || 'Not set');
    } else {
      console.log('❌ Chatbot not found in chatbots collection');
      return;
    }
    
    // Check deployment records
    console.log('\n🚀 2. Checking deployment records...');
    const deploymentsSnapshot = await db
      .collection('deployments')
      .where('chatbotId', '==', chatbotId)
      .get();
    
    if (deploymentsSnapshot.empty) {
      console.log('❌ No deployment records found for this chatbot');
    } else {
      console.log(`✅ Found ${deploymentsSnapshot.size} deployment record(s):`);
      deploymentsSnapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        console.log(`   Deployment ${index + 1}:`);
        console.log('     ID:', doc.id);
        console.log('     Status:', data.status);
        console.log('     Created:', data.createdAt?.toDate?.());
        console.log('     Firebase Project ID:', data.firebaseProjectId);
        console.log('     Deployment URL:', data.deploymentUrl);
        console.log('     User ID:', data.userId);
      });
    }
    
    // Check for any deployment with status 'deployed'
    console.log('\n✅ 3. Checking for deployed status...');
    const deployedSnapshot = await db
      .collection('deployments')
      .where('chatbotId', '==', chatbotId)
      .where('status', '==', 'deployed')
      .get();
    
    if (deployedSnapshot.empty) {
      console.log('❌ No deployment with status "deployed" found');
      console.log('   This is why the user management is failing!');
    } else {
      console.log('✅ Found deployed deployment(s)');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  console.log('\n==========================================');
  console.log('🎯 DIAGNOSIS:');
  console.log('The chatbot exists but doesn\'t have a proper deployment record');
  console.log('with status "deployed". This is required for user management.');
  console.log('\nSOLUTIONS:');
  console.log('1. Deploy the chatbot properly through the dashboard');
  console.log('2. Or manually create a deployment record');
  console.log('3. Or modify the user management to work without deployment');
}

debugChatbot().then(() => {
  console.log('\n✅ Debug complete');
  process.exit(0);
}).catch(console.error);
