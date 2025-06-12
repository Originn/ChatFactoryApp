import { NextRequest, NextResponse } from 'next/server';
import { ReusableFirebaseProjectService } from '@/services/reusableFirebaseProjectService';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatbotId, userId } = body;

    if (!chatbotId) {
      return NextResponse.json({ 
        error: 'Missing chatbot ID' 
      }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ 
        error: 'Missing user ID' 
      }, { status: 400 });
    }

    console.log('🧹 Starting reusable Firebase project cleanup for chatbot:', chatbotId);

    // Call the cleanup service
    const cleanupResult = await ReusableFirebaseProjectService.cleanupChatbotData(chatbotId, userId);

    if (cleanupResult.success) {
      console.log('✅ Reusable Firebase project cleanup completed successfully');
      return NextResponse.json({
        success: true,
        message: cleanupResult.message,
        details: cleanupResult.details
      });
    } else {
      console.error('❌ Reusable Firebase project cleanup failed:', cleanupResult.message);
      return NextResponse.json({
        success: false,
        message: cleanupResult.message,
        details: cleanupResult.details
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('❌ Error in reusable Firebase project cleanup API:', error);
    return NextResponse.json({ 
      error: `Error during cleanup: ${error.message}` 
    }, { status: 500 });
  }
}
