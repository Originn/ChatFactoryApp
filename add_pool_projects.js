/**
 * Script to add pool projects 004-010 to Firestore
 * Following the same pattern as existing pool projects 001-003
 */

const projects = [
  { id: 'chatfactory-pool-004', name: 'ChatFactory Pool 004' },
  { id: 'chatfactory-pool-005', name: 'ChatFactory Pool 005' },
  { id: 'chatfactory-pool-006', name: 'ChatFactory Pool 006' },
  { id: 'chatfactory-pool-007', name: 'ChatFactory Pool 007' },
  { id: 'chatfactory-pool-008', name: 'ChatFactory Pool 008' },
  { id: 'chatfactory-pool-009', name: 'ChatFactory Pool 009' },
  { id: 'chatfactory-pool-010', name: 'ChatFactory Pool 010' }
];

async function addPoolProjects() {
  console.log('🏊 Adding pool projects 004-010...');

  for (const project of projects) {
    console.log(`\n➕ Adding ${project.id}...`);

    try {
      const response = await fetch('http://localhost:3000/api/project-management', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: In a real implementation, you'd need proper authentication
          // For now, this is just a structure example
        },
        body: JSON.stringify({
          action: 'add-to-pool',
          projectId: project.id,
          projectType: 'pool',
          metadata: {
            projectName: project.name,
            region: 'us-central1',
            billingAccountId: process.env.BILLING_ACCOUNT_ID || '011C35-0F1A1B-49FBEC'
          }
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log(`✅ Successfully added ${project.id}`);
      } else {
        console.error(`❌ Failed to add ${project.id}:`, result.error);
      }
    } catch (error) {
      console.error(`❌ Error adding ${project.id}:`, error.message);
    }
  }

  console.log('\n🏊 Pool project addition complete!');
}

// Run if called directly
if (require.main === module) {
  addPoolProjects().catch(console.error);
}

module.exports = { addPoolProjects };