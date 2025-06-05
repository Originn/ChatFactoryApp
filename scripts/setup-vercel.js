// Helper script to prepare service account JSON for Vercel
const fs = require('fs');
const path = require('path');

function prepareForVercel() {
  try {
    const serviceAccountPath = './docsai-chatbot-app-30ce9bc4030d.json';
    
    if (!fs.existsSync(serviceAccountPath)) {
      console.error('❌ Service account file not found:', serviceAccountPath);
      process.exit(1);
    }
    
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    const jsonString = JSON.stringify(serviceAccount);
    
    console.log('🔧 Setting up Vercel environment variables:');
    console.log('');
    console.log('1. Go to your Vercel project dashboard');
    console.log('2. Navigate to Settings → Environment Variables');
    console.log('3. Add the following environment variable:');
    console.log('');
    console.log('   Name: GOOGLE_APPLICATION_CREDENTIALS_JSON');
    console.log('   Value: (copy the JSON below)');
    console.log('   Environments: ✓ Production ✓ Preview ✓ Development');
    console.log('');
    console.log('📋 JSON Content to copy:');
    console.log('═'.repeat(60));
    console.log(jsonString);
    console.log('═'.repeat(60));
    console.log('');
    console.log('✅ After adding this to Vercel, your deployments will have');
    console.log('   full Google Cloud authentication for:');
    console.log('   • Firebase project creation');
    console.log('   • Billing account attachment'); 
    console.log('   • Storage bucket creation');
    console.log('');
    console.log('🔒 Security Note: This JSON contains sensitive credentials.');
    console.log('   Only add it to trusted deployment platforms like Vercel.');
    
  } catch (error) {
    console.error('❌ Error reading service account file:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  prepareForVercel();
}

module.exports = { prepareForVercel };
