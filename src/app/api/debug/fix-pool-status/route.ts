import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST() {
  try {
    console.log('🔧 Fixing pool project status values...');

    // Find all projects with 'active' status (which should be 'available' for pool projects)
    const projectsRef = adminDb.collection('firebaseProjects');
    const activeProjectsQuery = projectsRef.where('status', '==', 'active');
    const snapshot = await activeProjectsQuery.get();

    if (snapshot.empty) {
      return NextResponse.json({
        message: 'No projects found with "active" status',
        fixed: 0
      });
    }

    const batch = adminDb.batch();
    let fixedCount = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const projectId = data.projectId;

      // Only fix pool projects (not dedicated projects)
      const isPoolProject = data.projectType === 'pool' || projectId?.includes('pool');

      if (isPoolProject) {
        console.log(`🔧 Fixing status for pool project: ${projectId}`);

        // Determine correct status based on projectInUse field
        const correctStatus = data.projectInUse === true ? 'in-use' : 'available';

        batch.update(doc.ref, {
          status: correctStatus,
          // Ensure projectInUse is properly set
          projectInUse: data.projectInUse === true ? true : false
        });

        fixedCount++;
      } else {
        console.log(`ℹ️ Skipping dedicated project: ${projectId} (status: active is correct for Firebase projects)`);
      }
    });

    if (fixedCount > 0) {
      await batch.commit();
      console.log(`✅ Fixed status for ${fixedCount} pool projects`);
    }

    return NextResponse.json({
      message: `Fixed status for ${fixedCount} pool projects`,
      fixed: fixedCount,
      totalFound: snapshot.size
    });

  } catch (error: any) {
    console.error('❌ Error fixing pool project status:', error);
    return NextResponse.json(
      { error: 'Failed to fix pool project status', details: error.message },
      { status: 500 }
    );
  }
}