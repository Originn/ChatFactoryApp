import { NextRequest, NextResponse } from 'next/server';
import { ReusableFirebaseProjectService } from '@/services/reusableFirebaseProjectService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatbotId, userId } = body;

    if (!chatbotId || !userId) {
      return NextResponse.json({ 
        error: 'Missing required parameters: chatbotId and userId' 
      }, { status: 400 });
    }

    console.log('🧹 API: Starting reusable Firebase project cleanup for chatbot:', chatbotId);

    // Call the cleanup service
    const cleanupResult = await ReusableFirebaseProjectService.cleanupChatbotData(chatbotId, userId);

    if (cleanupResult.success) {
      console.log('✅ API: Reusable Firebase project cleanup completed:', cleanupResult.message);
      
      return NextResponse.json({
        success: true,
        message: cleanupResult.message,
        details: cleanupResult.details
      });
    } else {
      console.warn('⚠️ API: Reusable Firebase project cleanup had issues:', cleanupResult.message);
      
      return NextResponse.json({
        success: false,
        message: cleanupResult.message,
        details: cleanupResult.details
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ API: Error during reusable Firebase project cleanup:', error);
    
    return NextResponse.json({ 
      error: `Cleanup failed: ${error.message}`,
      details: error
    }, { status: 500 });
  }
}
