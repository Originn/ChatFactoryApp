// DEBUG SCRIPT: Check current deployment status
// Run this to see what's happening with your testbot deployment

require('dotenv').config({ path: '.env.local' });

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const projectName = 'testbot'; // Your project name

async function checkDeploymentStatus() {
  if (!VERCEL_API_TOKEN) {
    console.error('❌ VERCEL_API_TOKEN not found in .env.local');
    return;
  }

  console.log(`🔍 Checking deployment status for: ${projectName}`);
  console.log('=' * 60);

  try {
    // 1. Get project details
    console.log('1️⃣ Getting project details...');
    const projectResponse = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
      headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
    });

    if (!projectResponse.ok) {
      const error = await projectResponse.json();
      console.error('❌ Project not found:', error.error?.message);
      return;
    }

    const projectData = await projectResponse.json();
    console.log(`✅ Project found: ${projectData.name}`);
    console.log(`   Framework: ${projectData.framework}`);
    console.log(`   Created: ${new Date(projectData.createdAt).toLocaleString()}`);
    console.log('');

    // 2. Check production deployment
    console.log('2️⃣ Checking production deployment...');
    if (projectData.targets?.production) {
      console.log('✅ Production target exists:');
      console.log(`   URL: ${projectData.targets.production.url || 'Not set'}`);
      console.log(`   Domain: ${projectData.targets.production.domain || 'Not set'}`);
    } else {
      console.log('❌ No production target found');
    }
    console.log('');

    // 3. List all deployments
    console.log('3️⃣ Getting recent deployments...');
    const deploymentsResponse = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectData.id}&limit=10`, {
      headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
    });

    if (deploymentsResponse.ok) {
      const deploymentsData = await deploymentsResponse.json();
      console.log(`📋 Found ${deploymentsData.deployments.length} recent deployments:`);
      
      deploymentsData.deployments.forEach((deployment, index) => {
        const isProduction = deployment.target === 'production';
        const status = deployment.state;
        const url = deployment.url;
        const createdAt = new Date(deployment.createdAt).toLocaleString();
        
        console.log(`   ${index + 1}. ${deployment.uid}`);
        console.log(`      URL: https://${url}`);
        console.log(`      Target: ${deployment.target} ${isProduction ? '🎯' : ''}`);
        console.log(`      Status: ${status} ${status === 'READY' ? '✅' : status === 'ERROR' ? '❌' : '⏳'}`);
        console.log(`      Created: ${createdAt}`);
        console.log('');
      });

      // Find the production deployment
      const productionDeployment = deploymentsData.deployments.find(d => d.target === 'production' && d.state === 'READY');
      if (productionDeployment) {
        console.log('🎯 Active production deployment found:');
        console.log(`   URL: https://${productionDeployment.url}`);
        console.log(`   This should be your main chatbot URL!`);
      } else {
        console.log('❌ No active production deployment found');
        console.log('💡 This explains why you see "No Production Deployment"');
      }
    }
    console.log('');

    // 4. Check domains/aliases
    console.log('4️⃣ Checking domains and aliases...');
    if (projectData.alias && projectData.alias.length > 0) {
      console.log(`📋 Found ${projectData.alias.length} domain(s):`);
      
      projectData.alias.forEach((alias, index) => {
        const domain = alias.domain || alias;
        const isProduction = domain.match(/^[a-zA-Z0-9-]+-[a-zA-Z0-9-]+\.vercel\.app$/);
        const isDeploymentSpecific = domain.includes('fvldnvlbr') || domain.includes('1fne8zdgg');
        
        console.log(`   ${index + 1}. ${domain}`);
        console.log(`      Type: ${isProduction ? 'Production format 🎯' : 'Other'}`);
        console.log(`      Deployment-specific: ${isDeploymentSpecific ? 'Yes ❌' : 'No ✅'}`);
        console.log(`      Target: ${alias.target || 'Not specified'}`);
        console.log('');
      });
    } else {
      console.log('❌ No domains found');
    }

    // 5. Recommendations
    console.log('5️⃣ Recommendations:');
    if (!projectData.targets?.production) {
      console.log('❌ Missing production deployment');
      console.log('💡 Solution: Re-deploy with the updated code that includes promotion');
    } else {
      console.log('✅ Production deployment exists');
      console.log(`🌐 Your production URL should be: ${projectData.targets.production.url}`);
    }

  } catch (error) {
    console.error('❌ Error checking deployment:', error);
  }
}

checkDeploymentStatus();
