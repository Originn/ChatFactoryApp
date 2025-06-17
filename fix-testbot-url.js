// QUICK FIX: Check and fix testbot production URL
// This script will check your current testbot deployment and try to get the clean production URL

require('dotenv').config({ path: '.env.local' });

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const projectName = 'testbot';

async function fixTestbotProductionUrl() {
  if (!VERCEL_API_TOKEN) {
    console.error('❌ VERCEL_API_TOKEN not found in .env.local');
    return;
  }

  console.log('🔧 Fixing testbot production URL...');
  console.log('=' * 50);

  try {
    // 1. Get current project status
    console.log('1️⃣ Getting current project status...');
    const projectResponse = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
      headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
    });

    if (!projectResponse.ok) {
      console.error('❌ Project not found');
      return;
    }

    const projectData = await projectResponse.json();
    console.log(`✅ Project found: ${projectData.name}`);
    
    // 2. Check current domains
    console.log('2️⃣ Analyzing current domains...');
    if (projectData.alias && projectData.alias.length > 0) {
      console.log(`📋 Found ${projectData.alias.length} domain(s):`);
      
      let hasCleanDomain = false;
      let cleanDomain = null;
      
      projectData.alias.forEach((alias, index) => {
        const domain = alias.domain || alias;
        const isClean = domain.match(/^[a-zA-Z0-9-]+-[a-zA-Z0-9-]+\.vercel\.app$/) && 
                       !domain.includes('107unuzgg') && 
                       !domain.includes('1fne8zdgg') && 
                       !domain.includes('fdncvxm99') &&
                       !domain.includes('fvldnvlbr');
        
        console.log(`   ${index + 1}. ${domain} ${isClean ? '✅ CLEAN' : '❌ DEPLOYMENT-SPECIFIC'}`);
        
        if (isClean) {
          hasCleanDomain = true;
          cleanDomain = domain;
        }
      });
      
      if (hasCleanDomain) {
        console.log('🎉 Clean production domain found!');
        console.log(`✅ Your correct production URL: https://${cleanDomain}`);
        return;
      } else {
        console.log('❌ No clean production domain found');
      }
    } else {
      console.log('❌ No domains found on project');
    }

    // 3. Get latest deployment and try to promote it
    console.log('3️⃣ Getting latest deployment...');
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

    console.log(`✅ Latest deployment: ${latestDeployment.uid}`);
    console.log(`   URL: https://${latestDeployment.url}`);
    console.log(`   Target: ${latestDeployment.target}`);

    // 4. Try to promote to production using correct API
    console.log('4️⃣ Promoting to production...');
    const promoteResponse = await fetch(`https://api.vercel.com/v9/projects/${projectData.id}/promote/${latestDeployment.uid}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    if (promoteResponse.ok) {
      console.log('✅ Deployment promoted successfully!');
      
      // Wait and check for clean production URL
      console.log('⏳ Waiting for clean production URL to appear...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      // Check updated project
      const updatedResponse = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
        headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
      });
      
      if (updatedResponse.ok) {
        const updatedProject = await updatedResponse.json();
        
        console.log('5️⃣ Checking for updated production URL...');
        
        // Look for production URL in targets
        if (updatedProject.targets?.production?.url) {
          const productionUrl = updatedProject.targets.production.url;
          const isClean = productionUrl.match(/^[a-zA-Z0-9-]+-[a-zA-Z0-9-]+\.vercel\.app$/) && 
                         !productionUrl.includes('107unuzgg') && 
                         !productionUrl.includes('1fne8zdgg') && 
                         !productionUrl.includes('fdncvxm99') &&
                         !productionUrl.includes('fvldnvlbr');
          
          console.log(`📊 Production target URL: ${productionUrl}`);
          console.log(`   Format: ${isClean ? '✅ CLEAN' : '❌ STILL DEPLOYMENT-SPECIFIC'}`);
          
          if (isClean) {
            console.log('🎉 SUCCESS! Clean production URL is now active!');
            console.log(`🌐 Your chatbot URL: https://${productionUrl}`);
          } else {
            console.log('⚠️ Production URL is still deployment-specific format');
          }
        }
        
        // Also check aliases for new clean domains
        if (updatedProject.alias && updatedProject.alias.length > 0) {
          const cleanAlias = updatedProject.alias.find(alias => {
            const domain = alias.domain || alias;
            return domain.match(/^[a-zA-Z0-9-]+-[a-zA-Z0-9-]+\.vercel\.app$/) && 
                   !domain.includes('107unuzgg') && 
                   !domain.includes('1fne8zdgg') && 
                   !domain.includes('fdncvxm99') &&
                   !domain.includes('fvldnvlbr');
          });
          
          if (cleanAlias) {
            const domain = cleanAlias.domain || cleanAlias;
            console.log('🎉 SUCCESS! Clean alias domain found!');
            console.log(`🌐 Your chatbot URL: https://${domain}`);
          }
        }
      }
      
    } else {
      const error = await promoteResponse.json();
      console.error('❌ Failed to promote deployment:', error.error?.message || 'Unknown error');
      
      // If promotion fails, at least show what URL we have
      if (latestDeployment.target === 'production') {
        console.log('💡 Deployment is already marked as production');
        console.log(`📋 Current URL: https://${latestDeployment.url}`);
        
        const isClean = latestDeployment.url.match(/^[a-zA-Z0-9-]+-[a-zA-Z0-9-]+\.vercel\.app$/) && 
                       !latestDeployment.url.includes('107unuzgg') &&
                       !latestDeployment.url.includes('1fne8zdgg') &&
                       !latestDeployment.url.includes('fdncvxm99') &&
                       !latestDeployment.url.includes('fvldnvlbr');
        
        if (isClean) {
          console.log('✅ This URL format is actually clean!');
        } else {
          console.log('❌ This URL is still deployment-specific');
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixTestbotProductionUrl();
