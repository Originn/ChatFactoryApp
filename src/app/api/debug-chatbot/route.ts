import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbotId');

    if (!chatbotId) {
      return NextResponse.json({ error: 'Missing chatbot ID' }, { status: 400 });
    }

    console.log(`🔍 Debugging chatbot: ${chatbotId}`);

    // Check chatbot document
    const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
    const chatbotData = chatbotDoc.exists ? {
      exists: true,
      id: chatbotDoc.id,
      name: chatbotDoc.data()?.name,
      status: chatbotDoc.data()?.status,
      userId: chatbotDoc.data()?.userId,
      requireAuth: chatbotDoc.data()?.requireAuth,
      createdAt: chatbotDoc.data()?.createdAt,
      deployment: chatbotDoc.data()?.deployment,
    } : { exists: false };

    // Check deployment records
    const deploymentsSnapshot = await adminDb
      .collection('deployments')
      .where('chatbotId', '==', chatbotId)
      .get();

    const deployments = deploymentsSnapshot.docs.map(doc => ({
      id: doc.id,
      status: doc.data().status,
      firebaseProjectId: doc.data().firebaseProjectId,
      deploymentUrl: doc.data().deploymentUrl,
      userId: doc.data().userId,
      createdAt: doc.data().createdAt,
    }));

    // Check for deployed status specifically
    const deployedSnapshot = await adminDb
      .collection('deployments')
      .where('chatbotId', '==', chatbotId)
      .where('status', '==', 'deployed')
      .get();

    const result = {
      chatbotId,
      chatbot: chatbotData,
      deployments: {
        total: deployments.length,
        records: deployments,
        deployedCount: deployedSnapshot.size,
      },
      diagnosis: {
        chatbotExists: chatbotDoc.exists,
        hasDeployments: deployments.length > 0,
        hasDeployedStatus: deployedSnapshot.size > 0,
        issue: deployedSnapshot.size === 0 ? 'No deployment with status "deployed" found' : null,
      }
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Debug error:', error);
    return NextResponse.json({ 
      error: `Debug failed: ${error.message}` 
    }, { status: 500 });
  }
}
