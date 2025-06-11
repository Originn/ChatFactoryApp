import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { chatbotId: string } }
) {
  try {
    const { chatbotId } = params;

    if (!chatbotId) {
      return NextResponse.json(
        { error: 'Chatbot ID is required' },
        { status: 400 }
      );
    }

    console.log('📋 Retrieving chatbot info for:', chatbotId);

    // Get chatbot data from Firestore
    const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
    
    if (!chatbotDoc.exists) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      );
    }

    const chatbotData = chatbotDoc.data();
    
    // Return basic chatbot information
    return NextResponse.json({
      success: true,
      id: chatbotId,
      name: chatbotData?.name || 'Chatbot',
      description: chatbotData?.description || '',
      status: chatbotData?.status || 'unknown',
      requireAuth: chatbotData?.requireAuth || false,
      deploymentUrl: chatbotData?.deployment?.deploymentUrl || null
    });

  } catch (error: any) {
    console.error('❌ Error retrieving chatbot info:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
