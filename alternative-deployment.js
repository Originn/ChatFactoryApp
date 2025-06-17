// ALTERNATIVE DEPLOYMENT APPROACH - Put this in your main deployment code
// This focuses on getting clean production domains

// Alternative approach: Create deployment with explicit domain request
async function deployWithCleanDomain(VERCEL_API_TOKEN, projectName, projectId, repoId) {
  console.log('🚀 Alternative deployment approach: Focusing on clean production domain...');
  
  try {
    // Step 1: Create multiple production deployments to trigger domain creation
    console.log('🔨 Creating production deployment to trigger clean domain...');
    
    const deploymentResponse = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: projectName,
        project: projectId,
        target: 'production',
        framework: 'nextjs',
        gitSource: {
          type: 'github',
          repo: 'Originn/ChatFactoryTemplate',
          ref: 'main',
          ...(repoId && { repoId })
        }
      })
    });

    if (!deploymentResponse.ok) {
      const error = await deploymentResponse.json();
      throw new Error(`Deployment failed: ${error.error?.message}`);
    }

    const deploymentData = await deploymentResponse.json();
    console.log(`✅ Deployment created: ${deploymentData.id}`);
    console.log(`📋 Initial URL: https://${deploymentData.url}`);

    // Step 2: Wait longer for deployment to complete and be ready
    console.log('⏳ Waiting for deployment to be fully ready (2 minutes)...');
    await new Promise(resolve => setTimeout(resolve, 120000)); // Wait 2 minutes

    // Step 3: Check deployment status
    const deploymentCheckResponse = await fetch(`https://api.vercel.com/v13/deployments/${deploymentData.id}`, {
      headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
    });

    if (deploymentCheckResponse.ok) {
      const deploymentStatus = await deploymentCheckResponse.json();
      console.log(`🔍 Deployment status: ${deploymentStatus.state}`);
      
      if (deploymentStatus.state === 'READY') {
        // Step 4: Try to promote
        console.log('🚀 Promoting ready deployment...');
        const promoteResponse = await fetch(`https://api.vercel.com/v9/projects/${projectId}/promote/${deploymentData.id}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        if (promoteResponse.ok) {
          console.log('✅ Deployment promoted successfully');
          
          // Step 5: Wait and check for clean production URL
          console.log('⏳ Waiting for clean production URL to appear...');
          await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute
          
          const projectCheckResponse = await fetch(`https://api.vercel.com/v9/projects/${projectId}`, {
            headers: { 'Authorization': `Bearer ${VERCEL_API_TOKEN}` }
          });
          
          if (projectCheckResponse.ok) {
            const projectData = await projectCheckResponse.json();
            
            // Check for clean production URL
            if (projectData.targets?.production?.url) {
              const productionUrl = projectData.targets.production.url;
              const isClean = productionUrl.match(/^[a-zA-Z0-9-]+-[a-zA-Z0-9-]+\.vercel\.app$/) && 
                             !productionUrl.includes('k49j9nres') &&
                             !productionUrl.includes('fdncvxm99') &&
                             !productionUrl.includes('107unuzgg') &&
                             !productionUrl.includes('1fne8zdgg') &&
                             !productionUrl.includes('fvldnvlbr');
              
              console.log(`🎯 Production URL: ${productionUrl}`);
              console.log(`   Format: ${isClean ? '✅ CLEAN' : '❌ DEPLOYMENT-SPECIFIC'}`);
              
              if (isClean) {
                return {
                  success: true,
                  url: `https://${productionUrl}`,
                  deploymentId: deploymentData.id,
                  isClean: true
                };
              }
            }
            
            // Check aliases for clean domains
            if (projectData.alias && projectData.alias.length > 0) {
              const cleanAlias = projectData.alias.find(alias => {
                const domain = alias.domain || alias;
                return domain.match(/^[a-zA-Z0-9-]+-[a-zA-Z0-9-]+\.vercel\.app$/) && 
                       !domain.includes('k49j9nres') &&
                       !domain.includes('fdncvxm99') &&
                       !domain.includes('107unuzgg') &&
                       !domain.includes('1fne8zdgg') &&
                       !domain.includes('fvldnvlbr');
              });
              
              if (cleanAlias) {
                const domain = cleanAlias.domain || cleanAlias;
                console.log(`🎉 Found clean alias domain: ${domain}`);
                return {
                  success: true,
                  url: `https://${domain}`,
                  deploymentId: deploymentData.id,
                  isClean: true
                };
              }
            }
          }
        } else {
          const promoteError = await promoteResponse.json();
          console.warn(`⚠️ Promotion failed: ${promoteError.error?.message}`);
        }
      } else {
        console.warn(`⚠️ Deployment not ready: ${deploymentStatus.state}`);
      }
    }

    // Fallback: Return deployment URL even if not clean
    return {
      success: true,
      url: deploymentData.url.startsWith('http') ? deploymentData.url : `https://${deploymentData.url}`,
      deploymentId: deploymentData.id,
      isClean: false
    };

  } catch (error) {
    console.error('❌ Alternative deployment failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Usage example:
// const result = await deployWithCleanDomain(VERCEL_API_TOKEN, projectName, projectId, repoId);
// if (result.success) {
//   console.log(`Final URL: ${result.url} (Clean: ${result.isClean})`);
// }
