/**
 * AuraDB API Test & Debug Script (TypeScript)
 * ============================================
 *
 * This script helps debug Neo4j AuraDB API issues by testing:
 * - Authentication (token generation)
 * - Tenant ID extraction
 * - Instance creation
 * - Instance status checking
 * - API response format analysis
 *
 * Usage:
 * 1. Ensure NEO4J_AURA_CLIENT_ID and NEO4J_AURA_CLIENT_SECRET are set in .env.local
 * 2. Run: npx tsx test-auradb.ts
 *    or: node -r esbuild-register test-auradb.ts
 */

import { Neo4jAuraService } from './src/services/neo4jAuraService';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testAuraDBAPI(): Promise<void> {
  console.log('🧪 Starting AuraDB API Testing...\n');

  try {
    // Test 1: API Connection Test
    console.log('1️⃣ Testing API Connection & Authentication...');
    const connectionTest = await Neo4jAuraService.testConnection();

    if (connectionTest.success) {
      console.log('✅ API Connection successful');
      console.log(`📊 Project count: ${connectionTest.projectCount}`);
    } else {
      console.log('❌ API Connection failed:', connectionTest.error);
      return;
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 2: List Existing Instances
    console.log('2️⃣ Listing Existing Instances...');
    const instances = await Neo4jAuraService.listInstances();

    console.log(`📋 Found ${instances.length} existing instances:`);
    instances.forEach((instance, index) => {
      console.log(`  ${index + 1}. ${instance.name} (${instance.id})`);
      console.log(`     Status: ${instance.status}`);
      console.log(`     Region: ${instance.region || 'N/A'}`);
      console.log(`     Memory: ${instance.memory || 'N/A'}`);
    });

    console.log('\n' + '='.repeat(60) + '\n');

    // Test 3: Create Test Instance
    console.log('3️⃣ Creating Test Instance...');
    const testChatbotId = `test-${Date.now()}`;
    const testChatbotName = `Test Chatbot ${new Date().toISOString().slice(0, 16)}`;

    console.log(`📝 Test Chatbot ID: ${testChatbotId}`);
    console.log(`📝 Test Chatbot Name: ${testChatbotName}`);

    const createResult = await Neo4jAuraService.createInstance(
      testChatbotId,
      testChatbotName,
      {
        region: 'us-central1',
        memory: '1GB',
        cloudProvider: 'gcp'
      }
    );

    if (createResult.success && createResult.instance) {
      const instance = createResult.instance;
      console.log('✅ Instance creation successful!');
      console.log('📋 Instance Details:');
      console.log(`   ID: ${instance.id}`);
      console.log(`   Name: ${instance.name}`);
      console.log(`   Status: ${instance.status}`);
      console.log(`   URI: ${instance.connection_url}`);
      console.log(`   Username: ${instance.username}`);
      console.log(`   Password: ${instance.password ? '[REDACTED]' : 'MISSING'}`);
      console.log(`   Region: ${instance.region || 'N/A'}`);
      console.log(`   Memory: ${instance.memory || 'N/A'}`);

      console.log('\n' + '='.repeat(60) + '\n');

      // Test 4: Check Instance Status
      console.log('4️⃣ Checking Instance Status...');
      const statusCheck = await Neo4jAuraService.getInstanceStatus(instance.id);

      if (statusCheck) {
        console.log('✅ Status check successful');
        console.log(`📊 Current status: ${statusCheck.status}`);
        console.log(`🔗 Connection URL: ${statusCheck.connection_url}`);
      } else {
        console.log('❌ Status check failed');
      }

      console.log('\n' + '='.repeat(60) + '\n');

      // Test 5: Cleanup (Delete Test Instance)
      console.log('5️⃣ Cleaning Up Test Instance...');
      const deleteConfirm = process.env.DELETE_TEST_INSTANCE !== 'false';

      if (deleteConfirm) {
        console.log('🗑️ Deleting test instance...');
        const deleted = await Neo4jAuraService.deleteInstance(instance.id);

        if (deleted) {
          console.log('✅ Test instance deleted successfully');
        } else {
          console.log('❌ Failed to delete test instance');
          console.log(`⚠️ Please manually delete instance: ${instance.id}`);
        }
      } else {
        console.log('⏭️ Skipping deletion (set DELETE_TEST_INSTANCE=true to auto-delete)');
        console.log(`⚠️ Remember to manually delete test instance: ${instance.id}`);
      }

    } else {
      console.log('❌ Instance creation failed:', createResult.error);

      // Additional debugging for failed creation
      console.log('\n🔍 Debugging Information:');
      console.log('- Check your Neo4j Aura credentials');
      console.log('- Verify your account has billing information (required for API access)');
      console.log('- Check if you\'ve reached free tier limits');
      console.log('- Review the raw API response above for more details');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
  }

  console.log('\n🎉 AuraDB API Testing Complete!');
}

// Helper function to show environment status
function checkEnvironment(): void {
  console.log('🔍 Environment Check:');
  console.log(`   NEO4J_AURA_CLIENT_ID: ${process.env.NEO4J_AURA_CLIENT_ID ? 'SET' : 'MISSING'}`);
  console.log(`   NEO4J_AURA_CLIENT_SECRET: ${process.env.NEO4J_AURA_CLIENT_SECRET ? 'SET' : 'MISSING'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
}

// Quick API format test function
async function testAPIResponseFormat(): Promise<void> {
  console.log('🔬 Testing Raw API Response Format...\n');

  try {
    // Get token first
    const token = await (Neo4jAuraService as any).getAccessToken();
    console.log('✅ Got access token');

    // Make a raw request to see exact response format
    const response = await fetch('https://api.neo4j.io/v1/instances', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`📡 Response status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log('🔍 Raw API response for listing instances:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ API Error:', errorText);
    }

  } catch (error) {
    console.error('❌ Raw API test failed:', error);
  }
}

// Run the tests
async function main(): Promise<void> {
  checkEnvironment();

  const args = process.argv.slice(2);

  if (args.includes('--format-only')) {
    await testAPIResponseFormat();
  } else {
    await testAuraDBAPI();
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { testAuraDBAPI, checkEnvironment, testAPIResponseFormat };