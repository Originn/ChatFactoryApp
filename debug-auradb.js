/**
 * Simple AuraDB Debug Runner
 * ==========================
 *
 * This script tests the AuraDB API by directly calling the endpoints
 * to help debug response format issues.
 */

// Load environment variables manually from .env.local
try {
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '.env.local');

  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...value] = line.split('=');
      if (key && value.length) {
        process.env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
    console.log('✅ Loaded .env.local');
  } else {
    console.log('⚠️ No .env.local found, using system environment variables');
  }
} catch (error) {
  console.log('⚠️ Could not load .env.local:', error.message);
}

// Helper to get Neo4j access token
async function getAccessToken() {
  const clientId = process.env.NEO4J_AURA_CLIENT_ID;
  const clientSecret = process.env.NEO4J_AURA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing Neo4j credentials. Set NEO4J_AURA_CLIENT_ID and NEO4J_AURA_CLIENT_SECRET');
  }

  console.log('🔐 Getting access token...');
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
    const errorText = await response.text();
    throw new Error(`Token request failed: ${response.status} - ${errorText}`);
  }

  const tokenData = await response.json();
  return tokenData.access_token;
}

// Helper to get tenant ID
async function getTenantId(token) {
  console.log('🔍 Getting tenant ID...');

  // Try to decode from JWT first
  try {
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    if (payload.usr) {
      console.log(`📋 Using user ID as tenant: ${payload.usr}`);
      return payload.usr;
    }
  } catch (e) {
    console.log('⚠️ Could not extract user ID from token, trying projects endpoint...');
  }

  // Fallback to projects endpoint
  const response = await fetch('https://api.neo4j.io/v1/projects', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Projects request failed: ${response.status} - ${errorText}`);
  }

  const projects = await response.json();
  if (projects.length === 0) {
    throw new Error('No projects found');
  }

  const activeProject = projects.find(p => p.status === 'active') || projects[0];
  console.log(`📋 Using project: ${activeProject.name} (${activeProject.id})`);
  return activeProject.id;
}

// Test instance creation
async function testInstanceCreation() {
  try {
    console.log('🧪 Starting AuraDB API Debug Test\n');

    const token = await getAccessToken();
    console.log('✅ Got access token\n');

    const tenantId = await getTenantId(token);
    console.log('✅ Got tenant ID\n');

    // Test listing existing instances first
    console.log('📋 Listing existing instances...');
    const listResponse = await fetch('https://api.neo4j.io/v1/instances', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`📡 List response status: ${listResponse.status}`);
    if (listResponse.ok) {
      const instancesResponse = await listResponse.json();
      const instances = instancesResponse.data || instancesResponse;
      console.log('🔍 Existing instances response format:');
      console.log(JSON.stringify(instancesResponse, null, 2));
      console.log(`\n📊 Found ${instances.length} existing instances\n`);

      // Clean up any test instances first
      for (const instance of instances) {
        if (instance.name.includes('debug-test') || instance.name.includes('test-')) {
          console.log(`🗑️ Cleaning up old test instance: ${instance.id} (${instance.name})`);
          const deleteResponse = await fetch(`https://api.neo4j.io/v1/instances/${instance.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          console.log(`   Delete status: ${deleteResponse.status}`);
        }
      }
      console.log('');
    }

    // Create test instance
    console.log('🏗️ Creating test instance...');
    const instanceRequest = {
      name: `debug-test-${Date.now()}`,
      version: '5',
      region: 'us-central1',
      memory: '1GB',
      type: 'free',
      tenant_id: tenantId,
      cloud_provider: 'gcp'
    };

    console.log('📋 Request payload:');
    console.log(JSON.stringify(instanceRequest, null, 2));

    const createResponse = await fetch('https://api.neo4j.io/v1/instances', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(instanceRequest)
    });

    console.log(`\n📡 Create response status: ${createResponse.status} ${createResponse.statusText}`);

    if (createResponse.ok) {
      const responseData = await createResponse.json();
      console.log('🔍 Raw create response:');
      console.log(JSON.stringify(responseData, null, 2));

      console.log('\n📊 Response analysis:');
      console.log(`- Type: ${typeof responseData}`);
      console.log(`- Is Array: ${Array.isArray(responseData)}`);
      console.log(`- Keys: ${Object.keys(responseData)}`);

      // Check for expected fields in the correct location
      const instanceData = responseData.data || responseData;
      const expectedFields = ['id', 'name', 'connection_url', 'username', 'password'];
      console.log('\n🔍 Field analysis:');
      expectedFields.forEach(field => {
        console.log(`  ${field}: ${instanceData[field] !== undefined ? '✅ Present' : '❌ Missing'} (${typeof instanceData[field]})`);
      });

      // Show what fields are actually available
      console.log('\n📋 Available fields in instance data:');
      Object.keys(instanceData).forEach(key => {
        console.log(`  - ${key}: ${typeof instanceData[key]}`);
      });

      // If we got an instance ID, try to delete it
      if (instanceData.id) {
        console.log(`\n🗑️ Cleaning up test instance: ${instanceData.id}`);
        const deleteResponse = await fetch(`https://api.neo4j.io/v1/instances/${instanceData.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        console.log(`🗑️ Delete status: ${deleteResponse.status}`);
      }

    } else {
      const errorText = await createResponse.text();
      console.log('❌ Create request failed:');
      console.log(errorText);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Environment check
function checkEnv() {
  console.log('🔍 Environment Status:');
  console.log(`  NEO4J_AURA_CLIENT_ID: ${process.env.NEO4J_AURA_CLIENT_ID ? 'SET' : 'MISSING'}`);
  console.log(`  NEO4J_AURA_CLIENT_SECRET: ${process.env.NEO4J_AURA_CLIENT_SECRET ? 'SET' : 'MISSING'}`);
  console.log('');
}

// Run the test
if (require.main === module) {
  checkEnv();
  testInstanceCreation();
}

module.exports = { testInstanceCreation, checkEnv };