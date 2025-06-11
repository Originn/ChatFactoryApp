import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbotId');

    if (!chatbotId) {
      return NextResponse.json({ error: 'Missing chatbot ID' }, { status: 400 });
    }

    console.log(`🔍 Debugging deployment search for chatbot: ${chatbotId}`);

    // 1. Check if chatbot exists
    const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
    console.log(`📋 Chatbot exists: ${chatbotDoc.exists}`);

    // 2. Search for ANY deployment records with this chatbotId (no status filter)
    const allDeploymentsSnapshot = await adminDb
      .collection('deployments')
      .where('chatbotId', '==', chatbotId)
      .get();

    console.log(`📦 Found ${allDeploymentsSnapshot.size} deployment records for chatbot ${chatbotId}`);

    const allDeployments = allDeploymentsSnapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`   Deployment ${doc.id}: status="${data.status}", firebaseProjectId="${data.firebaseProjectId}"`);
      return {
        id: doc.id,
        chatbotId: data.chatbotId,
        status: data.status,
        firebaseProjectId: data.firebaseProjectId,
        userId: data.userId,
        createdAt: data.createdAt,
        deploymentUrl: data.deploymentUrl,
      };
    });

    // 3. Specifically search for deployed status
    const deployedSnapshot = await adminDb
      .collection('deployments')
      .where('chatbotId', '==', chatbotId)
      .where('status', '==', 'deployed')
      .get();

    console.log(`✅ Found ${deployedSnapshot.size} deployment records with status="deployed"`);

    // 4. Check all possible status values for this chatbot
    const statusCounts: Record<string, number> = {};
    allDeployments.forEach(dep => {
      const status = dep.status || 'undefined';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const result = {
      chatbotId,
      chatbotExists: chatbotDoc.exists,
      totalDeployments: allDeployments.length,
      deployedStatusCount: deployedSnapshot.size,
      statusBreakdown: statusCounts,
      deployments: allDeployments,
      query: {
        collection: 'deployments',
        filters: [
          `chatbotId == "${chatbotId}"`,
          `status == "deployed"`
        ]
      },
      diagnosis: allDeployments.length === 0 
        ? 'No deployment records found at all' 
        : deployedSnapshot.size === 0 
        ? `Found ${allDeployments.length} deployment(s) but none have status="deployed"` 
        : 'Deployment records found with deployed status'
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Debug deployment error:', error);
    return NextResponse.json({ 
      error: `Debug failed: ${error.message}` 
    }, { status: 500 });
  }
}
