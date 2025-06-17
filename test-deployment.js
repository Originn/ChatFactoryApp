// TEST SCRIPT: Verify deployment URL detection
// This script tests if the deployment returns the correct production URL

const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

async function testDeployment(chatbotId, chatbotName) {
  console.log('🚀 Testing deployment for:', { chatbotId, chatbotName });
  console.log('=' * 50);

  try {
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';
    const deploymentUrl = `${API_BASE_URL}/vercel-deploy`;
    
    console.log('📡 Making deployment request to:', deploymentUrl);
    
    const response = await fetch(deploymentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chatbotId,
        chatbotName,
        userId: 'test-user-id'
      })
    });

    console.log('📊 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Deployment failed with status ${response.status}:`);
      console.error(errorText);
      return;
    }

    const data = await response.json();
    
    console.log('✅ Deployment response received');
    console.log('');
    
    // Analyze the response
    console.log('🔍 Deployment URL Analysis:');
    console.log(`   Deployment URL: ${data.url}`);
    console.log(`   Project Name: ${data.projectName}`);
    console.log(`   Deployment ID: ${data.deploymentId}`);
    console.log(`   Status: ${data.status}`);
    console.log('');
    
    // Check URL format
    const url = data.url;
    const isDeploymentSpecific = url.includes('fvldnvlbr') || url.includes('-git-');
    const isProductionFormat = url.match(/https:\/\/[a-zA-Z0-9-]+-[a-zA-Z0-9-]+\.vercel\.app$/);
    const isCustomDomain = !url.includes('.vercel.app');
    
    console.log('🎯 URL Format Analysis:');
    console.log(`   Is deployment-specific: ${isDeploymentSpecific ? '❌' : '✅'}`);
    console.log(`   Is production format: ${isProductionFormat ? '✅' : '❌'}`);
    console.log(`   Is custom domain: ${isCustomDomain ? '✅' : '❌'}`);
    console.log('');
    
    if (isDeploymentSpecific) {
      console.log('⚠️  WARNING: You are seeing a deployment-specific URL!');
      console.log('   This means the production URL detection is not working correctly.');
      console.log('   Expected format: https://projectname-randomwords.vercel.app');
      console.log(`   Actual format: ${url}`);
    } else if (isProductionFormat) {
      console.log('🎉 SUCCESS: You are seeing the correct production URL format!');
      console.log(`   Production URL: ${url}`);
    } else if (isCustomDomain) {
      console.log('🌐 CUSTOM DOMAIN: You are using a custom domain');
      console.log(`   Custom domain URL: ${url}`);
    } else {
      console.log('🤔 UNKNOWN: URL format is unexpected');
      console.log(`   Please check: ${url}`);
    }
    
    // Additional debug info
    if (data.debug) {
      console.log('');
      console.log('🐛 Debug Information:');
      console.log(`   Deployment method: ${data.debug.deploymentMethod}`);
      console.log(`   Target: ${data.debug.target}`);
      console.log(`   Git ref: ${data.debug.gitRef}`);
      console.log(`   Timestamp: ${data.debug.timestamp}`);
    }
    
    // Custom domain info
    if (data.customDomain) {
      console.log('');
      console.log('🌐 Custom Domain Information:');
      console.log(`   Domain: ${data.customDomain.domain}`);
      console.log(`   Verified: ${data.customDomain.verified}`);
      console.log(`   Status: ${data.customDomain.status}`);
    }

  } catch (error) {
    console.error('❌ Error testing deployment:', error);
  }
}

// Get parameters from command line
const chatbotId = process.argv[2] || 'test-chatbot-' + Date.now();
const chatbotName = process.argv[3] || 'Test Bot';

if (process.argv.length < 3) {
  console.log('Usage: node test-deployment.js <chatbot-id> [chatbot-name]');
  console.log('Example: node test-deployment.js my-test-bot "My Test Bot"');
  console.log('');
  console.log(`Using defaults: ID="${chatbotId}", Name="${chatbotName}"`);
  console.log('');
}

testDeployment(chatbotId, chatbotName);
