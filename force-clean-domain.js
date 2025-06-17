// FORCE CREATE CLEAN PRODUCTION DOMAIN
// This script forces Vercel to create a clean production domain for your project

require('dotenv').config({ path: '.env.local' });

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
const projectName = 'testbot';

async function forceCreateCleanDomain() {
  if (!VERCEL_API_TOKEN) {
    console.error('❌ VERCEL_API_TOKEN not found in .env.local');
    return;
  }

  console.log('🔧 Force creating clean production domain for testbot...');
  console.log('=' * 60);

  try {
    // 1. Get project details
    const projectResponse = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
      headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
    });

    if (!projectResponse.ok) {
      console.error('❌ Project not found');
      return;
    }

    const projectData = await projectResponse.json();
    console.log(`✅ Project found: ${projectData.name} (ID: ${projectData.id})`);

    // 2. Check current domains
    console.log('📋 Current domains:');
    if (projectData.alias && projectData.alias.length > 0) {
      projectData.alias.forEach((alias, index) => {
        const domain = alias.domain || alias;
        console.log(`   ${index + 1}. ${domain}`);
      });
    } else {
      console.log('   ❌ No domains found');
    }

    // 3. Strategy 1: Add a random clean domain
    console.log('\n🔨 Strategy 1: Adding clean random domain...');
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const cleanDomainName = `${projectName}-${randomSuffix}.vercel.app`;
    
    try {
      const addDomainResponse = await fetch(`https://api.vercel.com/v10/projects/${projectData.id}/domains`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: cleanDomainName
        })
      });

      if (addDomainResponse.ok) {
        const domainResult = await addDomainResponse.json();
        console.log(`✅ Successfully created clean domain: ${domainResult.name}`);
        console.log(`🌐 Your clean URL: https://${domainResult.name}`);
        return;
      } else {
        const domainError = await addDomainResponse.json();
        console.log(`⚠️ Failed to create domain: ${domainError.error?.message}`);
      }
    } catch (domainError) {
      console.warn('⚠️ Error in Strategy 1:', domainError);
    }

    // 4. Strategy 2: Create deployment to trigger default domain
    console.log('\n🔨 Strategy 2: Creating deployment to trigger default domain...');
    
    const deploymentResponse = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: projectName,
        project: projectData.id,
        target: 'production',
        framework: 'nextjs',
        gitSource: {
          type: 'github',
          repo: 'Originn/ChatFactoryTemplate',
          ref: 'main'
        }
      })
    });

    if (deploymentResponse.ok) {
      const deployment = await deploymentResponse.json();
      console.log(`✅ Created deployment: ${deployment.id}`);
      console.log(`📋 Deployment URL: https://${deployment.url}`);
      
      // Wait for deployment and check for clean domains
      console.log('⏳ Waiting for deployment to complete and domains to be created...');
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // Check for new domains
      const updatedProjectResponse = await fetch(`https://api.vercel.com/v9/projects/${projectData.id}`, {
        headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
      });
      
      if (updatedProjectResponse.ok) {
        const updatedProject = await updatedProjectResponse.json();
        console.log('\n📋 Updated domains after deployment:');
        
        if (updatedProject.alias && updatedProject.alias.length > 0) {
          let foundClean = false;
          updatedProject.alias.forEach((alias, index) => {
            const domain = alias.domain || alias;
            const isClean = domain.match(/^[a-zA-Z0-9-]+-[a-zA-Z0-9-]+\.vercel\.app$/) && 
                           !domain.includes('-git-') &&
                           !domain.includes('k49j9nres') &&
                           !domain.includes('fdncvxm99') &&
                           !domain.includes('107unuzgg') &&
                           !domain.includes('1fne8zdgg') &&
                           !domain.includes('fvldnvlbr');
            
            console.log(`   ${index + 1}. ${domain} ${isClean ? '✅ CLEAN' : '❌ DEPLOYMENT-SPECIFIC'}`);
            
            if (isClean) {
              foundClean = true;
              console.log(`🎉 SUCCESS! Clean production domain found: https://${domain}`);
            }
          });
          
          if (!foundClean) {
            console.log('⚠️ No clean production domains created yet');
          }
        } else {
          console.log('   ❌ Still no domains found after deployment');
        }
      }
      
      // Try to promote the deployment
      console.log('\n🚀 Attempting to promote deployment...');
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait more for deployment to be ready
      
      const promoteResponse = await fetch(`https://api.vercel.com/v9/projects/${projectData.id}/promote/${deployment.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (promoteResponse.ok) {
        console.log('✅ Deployment promoted successfully!');
        
        // Final check for clean production URL
        await new Promise(resolve => setTimeout(resolve, 15000));
        
        const finalProjectResponse = await fetch(`https://api.vercel.com/v9/projects/${projectData.id}`, {
          headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
        });
        
        if (finalProjectResponse.ok) {
          const finalProject = await finalProjectResponse.json();
          
          if (finalProject.targets?.production?.url) {
            const productionUrl = finalProject.targets.production.url;
            const isClean = productionUrl.match(/^[a-zA-Z0-9-]+-[a-zA-Z0-9-]+\.vercel\.app$/) && 
                           !productionUrl.includes('k49j9nres') &&
                           !productionUrl.includes('fdncvxm99') &&
                           !productionUrl.includes('107unuzgg') &&
                           !productionUrl.includes('1fne8zdgg') &&
                           !productionUrl.includes('fvldnvlbr');
            
            console.log(`\n🎯 Final production URL: ${productionUrl}`);
            console.log(`   Format: ${isClean ? '✅ CLEAN' : '❌ STILL DEPLOYMENT-SPECIFIC'}`);
            
            if (isClean) {
              console.log('🎉 SUCCESS! Your testbot now has a clean production URL!');
              console.log(`🌐 Use this URL: https://${productionUrl}`);
            }
          }
        }
        
      } else {
        const promoteError = await promoteResponse.json();
        console.log(`⚠️ Promotion failed: ${promoteError.error?.message}`);
      }
      
    } else {
      const deployError = await deploymentResponse.json();
      console.error(`❌ Failed to create deployment: ${deployError.error?.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

forceCreateCleanDomain();
