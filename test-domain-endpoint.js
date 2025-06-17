// TEST: Debug script to verify the new domain endpoint is working
// This script tests the /v9/projects/{id}/domains endpoint to ensure we get clean production URLs immediately

const fetch = require('node-fetch');
require('dotenv').config();

async function testDomainEndpoint() {
  const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
  
  if (!VERCEL_API_TOKEN) {
    console.error('❌ VERCEL_API_TOKEN not found in environment variables');
    return;
  }

  // Test with the actual project from the image
  const projectName = 'testbot'; // This should match the project in your image
  
  try {
    console.log('🔍 Testing domains endpoint for project:', projectName);
    
    // Get project details first to get the ID
    const projectResponse = await fetch(`https://api.vercel.com/v9/projects/${projectName}`, {
      headers: {
        'Authorization': `Bearer ${VERCEL_API_TOKEN}`
      }
    });
    
    if (!projectResponse.ok) {
      console.error('❌ Failed to get project details');
      return;
    }
    
    const projectData = await projectResponse.json();
    const projectId = projectData.id;
    
    console.log('✅ Project found with ID:', projectId);
    
    // Now test the domains endpoint
    const domainsResponse = await fetch(`https://api.vercel.com/v9/projects/${projectId}/domains`, {
      headers: {
        'Authorization': `Bearer ${VERCEL_API_TOKEN}`
      }
    });
    
    if (!domainsResponse.ok) {
      console.error('❌ Failed to get domains');
      return;
    }
    
    const domainsData = await domainsResponse.json();
    
    console.log('🔍 Domains API Response:');
    console.log('Total domains:', domainsData.domains?.length || 0);
    
    if (domainsData.domains && domainsData.domains.length > 0) {
      console.log('\n📋 ALL DOMAINS WITH POSITIONS:');
      domainsData.domains.forEach((domain, index) => {
        console.log(`${index}: ${domain.name} (verified: ${domain.verified})`);
      });
      
      // Filter out git branch domains
      const nonGitDomains = domainsData.domains.filter(domain => {
        return domain.name && 
               domain.name.endsWith('.vercel.app') && 
               !domain.name.includes('-git-');
      });
      
      console.log('\n🎯 NON-GIT VERCEL.APP DOMAINS WITH POSITIONS:');
      nonGitDomains.forEach((domain, index) => {
        console.log(`${index}: ${domain.name}`);
      });
      
      console.log('\n💡 QUESTION: Which index has the clean domain like "testbot-gray.vercel.app"?');
      console.log('📝 Once you identify it, we can update the code to use that specific index!');
      
      if (nonGitDomains.length > 0) {
        console.log(`\n🔍 Currently the API would return: https://${nonGitDomains[0].name}`);
        console.log('⚠️  This might not be the one you want - let us know which index to use!');
      }
    } else {
      console.log('ℹ️ No domains found for this project');
    }
    
  } catch (error) {
    console.error('❌ Error testing domain endpoint:', error.message);
  }
}

// Run the test
testDomainEndpoint();