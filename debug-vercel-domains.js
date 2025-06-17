// DEBUG SCRIPT: Test Vercel domain detection
// This script helps debug why you're seeing deployment-specific URLs instead of production URLs

const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;

async function debugVercelDomains(projectName) {
  if (!VERCEL_API_TOKEN) {
    console.error('❌ VERCEL_API_TOKEN environment variable not set');
    process.exit(1);
  }

  console.log(`🔍 Debugging domains for project: ${projectName}`);
  console.log('=' * 50);

  try {
    // Get project details
    const projectResponse = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
      headers: {
        'Authorization': `Bearer ${VERCEL_API_TOKEN}`
      }
    });

    if (!projectResponse.ok) {
      const error = await projectResponse.json();
      console.error('❌ Failed to fetch project:', error);
      return;
    }

    const projectData = await projectResponse.json();
    
    console.log('📊 Project Overview:');
    console.log(`   Name: ${projectData.name}`);
    console.log(`   ID: ${projectData.id}`);
    console.log(`   Framework: ${projectData.framework || 'Not specified'}`);
    console.log(`   Created: ${new Date(projectData.createdAt).toLocaleString()}`);
    console.log('');

    // Analyze aliases
    console.log('🌐 Domain Analysis:');
    if (projectData.alias && projectData.alias.length > 0) {
      console.log(`   Total domains: ${projectData.alias.length}`);
      console.log('');
      
      projectData.alias.forEach((alias, index) => {
        const domain = alias.domain || alias;
        const isString = typeof domain === 'string';
        const isVercelApp = isString && domain.endsWith('.vercel.app');
        const isGitDeployment = isString && domain.includes('-git-');
        const isDeploymentSpecific = isString && domain.includes('fvldnvlbr');
        const matchesPattern = isString && domain.match(/^[a-zA-Z0-9-]+-[a-zA-Z0-9-]+\.vercel\.app$/);
        
        console.log(`   ${index + 1}. ${domain}`);
        console.log(`      Type: ${typeof domain}`);
        console.log(`      Is .vercel.app: ${isVercelApp}`);
        console.log(`      Is Git deployment: ${isGitDeployment}`);
        console.log(`      Is deployment-specific: ${isDeploymentSpecific}`);
        console.log(`      Matches production pattern: ${matchesPattern}`);
        console.log(`      Target: ${alias.target || 'Not specified'}`);
        console.log(`      Created: ${alias.createdAt ? new Date(alias.createdAt).toLocaleString() : 'Unknown'}`);
        
        // Determine if this looks like the production domain
        const isLikelyProduction = isVercelApp && !isGitDeployment && !isDeploymentSpecific && matchesPattern;
        if (isLikelyProduction) {
          console.log(`      🎯 LIKELY PRODUCTION DOMAIN: https://${domain}`);
        }
        console.log('');
      });
    } else {
      console.log('   ❌ No domains found');
    }

    // Check targets
    console.log('🎯 Production Targets:');
    if (projectData.targets) {
      if (projectData.targets.production) {
        console.log(`   Production URL: ${projectData.targets.production.url || 'Not set'}`);
        console.log(`   Production domain: ${projectData.targets.production.domain || 'Not set'}`);
      } else {
        console.log('   ❌ No production target found');
      }
    } else {
      console.log('   ❌ No targets found');
    }

    console.log('');
    console.log('🔧 Recommended Production URL:');
    
    // Apply the same logic as the fixed deployment code
    let recommendedUrl = null;
    
    if (projectData.alias && projectData.alias.length > 0) {
      const defaultProductionAlias = projectData.alias.find((alias) => {
        const domain = alias.domain || alias;
        return typeof domain === 'string' && 
               domain.endsWith('.vercel.app') && 
               !domain.includes('-git-') && 
               !domain.includes('fvldnvlbr') && 
               domain.match(/^[a-zA-Z0-9-]+-[a-zA-Z0-9-]+\.vercel\.app$/);
      });
      
      if (defaultProductionAlias) {
        const domain = defaultProductionAlias.domain || defaultProductionAlias;
        recommendedUrl = `https://${domain}`;
      }
    }
    
    if (recommendedUrl) {
      console.log(`   ✅ ${recommendedUrl}`);
    } else {
      console.log(`   ⚠️ Could not determine production URL`);
      console.log(`   💡 Fallback: https://${projectName}.vercel.app`);
    }

  } catch (error) {
    console.error('❌ Error debugging domains:', error);
  }
}

// Get project name from command line arguments
const projectName = process.argv[2];

if (!projectName) {
  console.error('Usage: node debug-vercel-domains.js <project-name>');
  console.error('Example: node debug-vercel-domains.js testbot');
  process.exit(1);
}

debugVercelDomains(projectName);
