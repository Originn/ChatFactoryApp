// TEST: Simple script to check domain positions - uses built-in Node.js modules only
// No extra dependencies needed!

const https = require('https');

const VERCEL_API_TOKEN = 'pwSBQBGsGwlgeOSMvUKgVXlu'; // Your actual token from .env.local

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      headers: {
        'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
        'User-Agent': 'Node.js',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ ok: res.statusCode === 200, json, status: res.statusCode });
        } catch (err) {
          reject(new Error(`Invalid JSON: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

async function testDomainEndpoint() {
  console.log('🔍 Testing domains for testbot project...');
  
  const projectName = 'testbot'; // The project from your image
  
  try {
    console.log('Getting project details...');
    
    // Get project details first to get the ID
    const projectResponse = await makeRequest(`https://api.vercel.com/v9/projects/${projectName}`);
    
    if (!projectResponse.ok) {
      console.error('❌ Failed to get project details:', projectResponse.json.error?.message || 'Unknown error');
      console.log('Status:', projectResponse.status);
      return;
    }
    
    const projectData = projectResponse.json;
    const projectId = projectData.id;
    
    console.log('✅ Project found with ID:', projectId);
    
    // Now test the domains endpoint
    console.log('Getting domains...');
    const domainsResponse = await makeRequest(`https://api.vercel.com/v9/projects/${projectId}/domains`);
    
    if (!domainsResponse.ok) {
      console.error('❌ Failed to get domains:', domainsResponse.json.error?.message || 'Unknown error');
      console.log('Status:', domainsResponse.status);
      return;
    }
    
    const domainsData = domainsResponse.json;
    
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