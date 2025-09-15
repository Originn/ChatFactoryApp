/**
 * Neo4j AuraDB Stuck Instance Cleanup Tool
 * ========================================
 *
 * This script helps deal with instances stuck in "destroying" state
 * by checking actual API status vs what's shown in the console.
 */

// Load environment variables manually
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...value] = line.split('=');
      if (key && value.length) {
        process.env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
  }
} catch (error) {
  console.log('⚠️ Could not load .env.local:', error.message);
}

// Get access token
async function getAccessToken() {
  const clientId = process.env.NEO4J_AURA_CLIENT_ID;
  const clientSecret = process.env.NEO4J_AURA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Neo4j credentials');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch('https://api.neo4j.io/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error(`Token request failed: ${response.status}`);
  }

  const tokenData = await response.json();
  return tokenData.access_token;
}

// Get tenant ID
async function getTenantId(token) {
  try {
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    if (payload.usr) {
      return payload.usr;
    }
  } catch (e) {
    // Fallback to projects endpoint
  }

  const response = await fetch('https://api.neo4j.io/v1/projects', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Projects request failed: ${response.status}`);
  }

  const projects = await response.json();
  const projectsData = projects.data || projects;

  if (projectsData.length === 0) {
    throw new Error('No projects found');
  }

  const activeProject = projectsData.find(p => p.status === 'active') || projectsData[0];
  return activeProject.id;
}

// Main cleanup function
async function cleanupStuckInstances() {
  try {
    console.log('🔧 Neo4j AuraDB Stuck Instance Cleanup Tool\n');

    const token = await getAccessToken();
    const tenantId = await getTenantId(token);

    console.log('✅ Authentication successful');
    console.log(`📋 Tenant ID: ${tenantId}\n`);

    // List all instances
    console.log('📋 Fetching all instances...');
    const listResponse = await fetch('https://api.neo4j.io/v1/instances', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!listResponse.ok) {
      throw new Error(`Failed to list instances: ${listResponse.status}`);
    }

    const instancesResponse = await listResponse.json();
    const instances = instancesResponse.data || instancesResponse;

    console.log(`📊 Found ${instances.length} instances via API:\n`);

    if (instances.length === 0) {
      console.log('✅ No instances found. Your account is clean!');
      console.log('💡 If you see instances stuck in "destroying" in the Neo4j console,');
      console.log('   this confirms they are ghost instances that no longer exist.');
      return;
    }

    // Analyze each instance
    for (let i = 0; i < instances.length; i++) {
      const instance = instances[i];
      console.log(`${i + 1}. Instance: ${instance.name} (${instance.id})`);
      console.log(`   Created: ${instance.created_at}`);
      console.log(`   Type: ${instance.type || 'Unknown'}`);
      console.log(`   Cloud: ${instance.cloud_provider || 'Unknown'}`);

      // Try to get detailed status
      console.log('   Checking detailed status...');
      const statusResponse = await fetch(`https://api.neo4j.io/v1/instances/${instance.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const detailedInstance = statusData.data || statusData;
        console.log(`   ✅ Status: ${detailedInstance.status || 'No status field'}`);

        if (detailedInstance.connection_url) {
          console.log(`   🔗 URL: ${detailedInstance.connection_url}`);
        }
      } else {
        console.log(`   ❌ Status check failed: ${statusResponse.status}`);
        if (statusResponse.status === 404) {
          console.log('   💡 This instance might be in the deletion queue');
        }
      }

      // Check if it's a test instance we can clean up
      if (instance.name.includes('test') || instance.name.includes('debug')) {
        console.log('   🧹 This appears to be a test instance. Attempting cleanup...');

        const deleteResponse = await fetch(`https://api.neo4j.io/v1/instances/${instance.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        console.log(`   🗑️ Delete request status: ${deleteResponse.status}`);

        if (deleteResponse.status === 202) {
          console.log('   ✅ Deletion initiated successfully');
        } else if (deleteResponse.status === 404) {
          console.log('   💡 Instance already deleted (ghost instance)');
        } else {
          console.log('   ⚠️ Deletion failed or in progress');
        }
      }

      console.log(''); // Empty line between instances
    }

    // Summary
    console.log('📋 Summary:');
    console.log(`- Found ${instances.length} active instances via API`);
    console.log('- If Neo4j console shows more instances than this, they are ghost instances');
    console.log('- Ghost instances stuck in "destroying" state don\'t count against your quota');
    console.log('- You can safely ignore them or contact Neo4j support');

    // Quota check
    const freeInstanceCount = instances.filter(i =>
      i.type === 'free-db' || i.type === 'free'
    ).length;

    console.log(`\n🎯 Free Tier Status:`);
    console.log(`- Active free instances: ${freeInstanceCount}/1`);

    if (freeInstanceCount === 0) {
      console.log('✅ You can create a new free instance');
    } else if (freeInstanceCount === 1) {
      console.log('⚠️ Free tier quota used. Delete existing instance to create new one.');
    } else {
      console.log('🚨 Unexpected: More than 1 free instance found!');
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
  }
}

// Run the cleanup
if (require.main === module) {
  cleanupStuckInstances();
}

module.exports = { cleanupStuckInstances };