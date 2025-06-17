// UTILITY SCRIPT: Promote existing deployment to production
// Use this to promote an existing deployment to production without redeploying

require('dotenv').config({ path: '.env.local' });

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;

async function promoteToProduction(projectName, deploymentId = null) {
  if (!VERCEL_API_TOKEN) {
    console.error('❌ VERCEL_API_TOKEN not found in .env.local');
    return;
  }

  console.log(`🚀 Promoting deployment to production for: ${projectName}`);
  console.log('=' * 60);

  try {
    // Get project details
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

    // If no deployment ID provided, get the latest deployment
    let targetDeploymentId = deploymentId;
    
    if (!targetDeploymentId) {
      console.log('🔍 Getting latest deployment...');
      const deploymentsResponse = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectData.id}&limit=5`, {
        headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
      });

      if (!deploymentsResponse.ok) {
        console.error('❌ Failed to get deployments');
        return;
      }

      const deploymentsData = await deploymentsResponse.json();
      const latestDeployment = deploymentsData.deployments.find(d => d.state === 'READY');
      
      if (!latestDeployment) {
        console.error('❌ No ready deployment found');
        return;
      }

      targetDeploymentId = latestDeployment.uid;
      console.log(`✅ Using latest deployment: ${targetDeploymentId}`);
      console.log(`   URL: https://${latestDeployment.url}`);
    }

    // Promote deployment
    console.log(`🚀 Promoting deployment ${targetDeploymentId}...`);
    const promoteResponse = await fetch(`https://api.vercel.com/v9/projects/${projectData.id}/promote/${targetDeploymentId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (!promoteResponse.ok) {
      const error = await promoteResponse.json();
      console.error('❌ Failed to promote deployment:', error.error?.message);
      return;
    }

    console.log('✅ Deployment promoted successfully!');
    
    // Wait a moment and check the result
    console.log('⏳ Waiting for production deployment to update...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check production URL
    const updatedProjectResponse = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
      headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
    });

    if (updatedProjectResponse.ok) {
      const updatedProjectData = await updatedProjectResponse.json();
      if (updatedProjectData.targets?.production?.url) {
        console.log('🎉 Production deployment is now active!');
        console.log(`🌐 Production URL: ${updatedProjectData.targets.production.url}`);
        
        // Check if it's the clean format
        const url = updatedProjectData.targets.production.url;
        const isCleanFormat = url.match(/^[a-zA-Z0-9-]+-[a-zA-Z0-9-]+\.vercel\.app$/);
        
        if (isCleanFormat) {
          console.log('✅ URL format is correct (clean production URL)');
        } else {
          console.log('⚠️ URL format might still be deployment-specific');
        }
      } else {
        console.log('⚠️ Production deployment promoted but URL not yet available');
        console.log('💡 Check your Vercel dashboard in a few minutes');
      }
    }

  } catch (error) {
    console.error('❌ Error promoting deployment:', error);
  }
}

// Get parameters from command line
const projectName = process.argv[2];
const deploymentId = process.argv[3];

if (!projectName) {
  console.log('Usage: node promote-to-production.js <project-name> [deployment-id]');
  console.log('');
  console.log('Examples:');
  console.log('  node promote-to-production.js testbot');
  console.log('  node promote-to-production.js testbot dpl_abc123');
  console.log('');
  console.log('If deployment-id is not provided, the latest ready deployment will be used.');
  process.exit(1);
}

promoteToProduction(projectName, deploymentId);
