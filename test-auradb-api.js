/**
 * AuraDB API Test & Debug Script
 * ==============================
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
 * 2. Run: node test-auradb-api.js
 */

// Import the Neo4j service
const { Neo4jAuraService } = require('./src/services/neo4jAuraService.ts');

async function testAuraDBAPI() {
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

      // Test 5: Wait for Instance (optional - comment out if not needed)
      /*
      console.log('5️⃣ Waiting for Instance to Become Ready (max 2 minutes)...');
      const readyInstance = await Neo4jAuraService.waitForInstanceReady(instance.id, 2);

      if (readyInstance) {
        console.log('✅ Instance is ready!');
        console.log(`📊 Final status: ${readyInstance.status}`);
      } else {
        console.log('⏰ Instance not ready within timeout (this is normal for free tier)');
      }
      */

      console.log('\n' + '='.repeat(60) + '\n');

      // Test 6: Cleanup (Delete Test Instance)
      console.log('6️⃣ Cleaning Up Test Instance...');
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
    console.error('Stack trace:', error.stack);
  }

  console.log('\n🎉 AuraDB API Testing Complete!');
}

// Helper function to show environment status
function checkEnvironment() {
  console.log('🔍 Environment Check:');
  console.log(`   NEO4J_AURA_CLIENT_ID: ${process.env.NEO4J_AURA_CLIENT_ID ? 'SET' : 'MISSING'}`);
  console.log(`   NEO4J_AURA_CLIENT_SECRET: ${process.env.NEO4J_AURA_CLIENT_SECRET ? 'SET' : 'MISSING'}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
}

// Run if called directly
if (require.main === module) {
  // Load environment variables
  require('dotenv').config({ path: '.env.local' });

  checkEnvironment();
  testAuraDBAPI().catch(console.error);
}

module.exports = { testAuraDBAPI, checkEnvironment };