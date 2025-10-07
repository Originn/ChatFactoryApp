import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST() {
  try {
    console.log('🔄 Clearing chatfactory-pool-001 lastUsedAt...');

    const projectRef = adminDb.collection('firebaseProjects').doc('chatfactory-pool-001');

    await projectRef.update({
      lastUsedAt: null,
      chatbotId: null,
      userId: null,
      status: 'available'
    });

    console.log('✅ Cleared chatfactory-pool-001 completely');

    // Verify the update
    const doc = await projectRef.get();
    const data = doc.data();

    return NextResponse.json({
      message: 'Cleared chatfactory-pool-001 completely',
      project: {
        id: 'chatfactory-pool-001',
        status: data?.status,
        chatbotId: data?.chatbotId,
        userId: data?.userId,
        lastUsedAt: data?.lastUsedAt
      }
    });

  } catch (error: any) {
    console.error('❌ Error clearing pool-001:', error);
    return NextResponse.json(
      { error: 'Failed to clear pool-001', details: error.message },
      { status: 500 }
    );
  }
}