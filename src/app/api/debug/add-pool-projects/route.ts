import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST() {
  try {
    console.log('🏊 Adding pool projects to projectMappings collection...');

    const poolProjects = [
      'chatfactory-pool-001',
      'chatfactory-pool-002',
      'chatfactory-pool-003',
      'chatfactory-pool-004',
      'chatfactory-pool-005',
      'chatfactory-pool-006',
      'chatfactory-pool-007',
      'chatfactory-pool-008',
      'chatfactory-pool-009',
      'chatfactory-pool-010'
    ];

    const batch = adminDb.batch();
    let addedCount = 0;

    for (const projectId of poolProjects) {
      // Check if project already exists
      const existingDoc = await adminDb.collection('firebaseProjects').doc(projectId).get();

      if (!existingDoc.exists) {
        console.log(`➕ Adding pool project: ${projectId}`);

        const projectRef = adminDb.collection('firebaseProjects').doc(projectId);
        batch.set(projectRef, {
          projectId,
          projectType: 'pool',
          status: 'available',
          chatbotId: null,
          userId: null,
          lastUsedAt: null,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });

        addedCount++;
      } else {
        console.log(`ℹ️ Pool project already exists: ${projectId}`);
      }
    }

    if (addedCount > 0) {
      await batch.commit();
      console.log(`✅ Added ${addedCount} pool projects to mapping`);
    }

    // Get updated status
    const snapshot = await adminDb.collection('firebaseProjects').get();
    const projects = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
      lastUsedAt: doc.data().lastUsedAt?.toDate?.()?.toISOString() || null,
    }));

    const stats = {
      total: projects.length,
      available: projects.filter(p => p.status === 'available').length,
      inUse: projects.filter(p => p.status === 'in-use').length
    };

    return NextResponse.json({
      message: `Added ${addedCount} pool projects. Total pool status:`,
      added: addedCount,
      projects,
      stats
    });

  } catch (error: any) {
    console.error('❌ Error adding pool projects:', error);
    return NextResponse.json(
      { error: 'Failed to add pool projects', details: error.message },
      { status: 500 }
    );
  }
}