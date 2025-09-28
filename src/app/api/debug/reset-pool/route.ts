import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST() {
  try {
    console.log('🔄 Resetting all pool projects to available status...');

    const snapshot = await adminDb.collection('firebaseProjects').get();

    if (snapshot.empty) {
      return NextResponse.json({
        message: 'No projects found in pool',
        updated: 0
      });
    }

    const batch = adminDb.batch();
    let updateCount = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data();

      // Only reset pool projects (not dedicated ones)
      if (data.projectType === 'pool' && data.status === 'in-use') {
        console.log(`🔄 Resetting project ${doc.id} to available`);

        batch.update(doc.ref, {
          status: 'available',
          chatbotId: null,
          userId: null,
          lastUsedAt: null,
          updatedAt: Timestamp.now()
        });
        updateCount++;
      }
    });

    if (updateCount > 0) {
      await batch.commit();
      console.log(`✅ Reset ${updateCount} projects to available`);
    }

    return NextResponse.json({
      message: `Reset ${updateCount} projects to available status`,
      updated: updateCount
    });

  } catch (error: any) {
    console.error('❌ Error resetting pool:', error);
    return NextResponse.json(
      { error: 'Failed to reset pool', details: error.message },
      { status: 500 }
    );
  }
}