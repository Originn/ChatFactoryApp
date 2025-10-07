import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST() {
  try {
    console.log('🔄 Fixing pool project statuses...');

    const snapshot = await adminDb.collection('firebaseProjects').get();
    const batch = adminDb.batch();
    let fixedCount = 0;

    snapshot.docs.forEach(doc => {
      const data = doc.data();

      if (data.projectType === 'pool') {
        let newStatus: string;

        if (data.chatbotId) {
          // Project is assigned to a chatbot = in-use
          newStatus = 'in-use';
        } else {
          // Project not assigned = available
          newStatus = 'available';
        }

        if (data.status !== newStatus) {
          console.log(`🔧 Fixing ${doc.id}: ${data.status} → ${newStatus}`);

          batch.update(doc.ref, {
            status: newStatus,
            updatedAt: Timestamp.now()
          });

          fixedCount++;
        }
      }
    });

    if (fixedCount > 0) {
      await batch.commit();
      console.log(`✅ Fixed ${fixedCount} pool project statuses`);
    }

    // Get updated status
    const updatedSnapshot = await adminDb.collection('firebaseProjects').get();
    const projects = updatedSnapshot.docs
      .filter(doc => doc.data().projectType === 'pool')
      .map(doc => ({
        id: doc.id,
        status: doc.data().status,
        chatbotId: doc.data().chatbotId,
        projectType: doc.data().projectType
      }));

    const stats = {
      total: projects.length,
      available: projects.filter(p => p.status === 'available').length,
      inUse: projects.filter(p => p.status === 'in-use').length
    };

    return NextResponse.json({
      message: `Fixed ${fixedCount} pool project statuses`,
      fixed: fixedCount,
      projects,
      stats
    });

  } catch (error: any) {
    console.error('❌ Error fixing pool statuses:', error);
    return NextResponse.json(
      { error: 'Failed to fix pool statuses', details: error.message },
      { status: 500 }
    );
  }
}