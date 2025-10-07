import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET() {
  try {
    console.log('🔍 Checking project pool status...');

    const snapshot = await adminDb.collection('firebaseProjects').get();

    if (snapshot.empty) {
      return NextResponse.json({
        message: 'No projects found in pool',
        projects: [],
        stats: { total: 0, available: 0, inUse: 0 }
      });
    }

    const projects = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        status: data.status,
        projectType: data.projectType,
        chatbotId: data.chatbotId || null,
        userId: data.userId || null,
        lastUsedAt: data.lastUsedAt ? data.lastUsedAt.toDate().toISOString() : null,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
      };
    });

    const stats = {
      total: projects.length,
      available: projects.filter(p => p.status === 'available').length,
      inUse: projects.filter(p => p.status === 'in-use').length
    };

    return NextResponse.json({
      message: `Found ${projects.length} projects in pool`,
      projects,
      stats
    });

  } catch (error: any) {
    console.error('❌ Error checking pool:', error);
    return NextResponse.json(
      { error: 'Failed to check pool status', details: error.message },
      { status: 500 }
    );
  }
}