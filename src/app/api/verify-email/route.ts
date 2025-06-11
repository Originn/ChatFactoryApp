import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { ChatbotFirebaseService } from '@/services/chatbotFirebaseService';

export async function POST(request: NextRequest) {
  try {
    const { token, chatbotId } = await request.json();

    if (!token || !chatbotId) {
      return NextResponse.json({ 
        error: 'Missing required parameters' 
      }, { status: 400 });
    }

    // First validate the token to get the user ID
    const validation = await ChatbotFirebaseService.validateVerificationToken(token, chatbotId);
    
    if (!validation.valid) {
      return NextResponse.json({ 
        error: validation.error || 'Invalid verification token' 
      }, { status: 400 });
    }

    // Verify the user's email using the chatbot's dedicated Firebase project
    const result = await ChatbotFirebaseService.verifyUserEmail(
      validation.userId!, 
      chatbotId, 
      token
    );

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Failed to verify email' 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully! You can now access the chatbot.'
    });

  } catch (error: any) {
    console.error('Email verification error:', error);
    return NextResponse.json({ 
      error: `Failed to verify email: ${error.message}` 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const chatbotId = searchParams.get('chatbot');

    if (!token || !chatbotId) {
      return NextResponse.json({ 
        error: 'Missing verification token or chatbot ID' 
      }, { status: 400 });
    }

    // Validate the token using the chatbot's dedicated Firebase project
    const validation = await ChatbotFirebaseService.validateVerificationToken(token, chatbotId);
    
    if (!validation.valid) {
      return NextResponse.json({ 
        error: validation.error || 'Invalid verification token' 
      }, { status: 400 });
    }

    // Get chatbot info from main database
    const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
    const chatbotData = chatbotDoc.data();

    return NextResponse.json({
      success: true,
      message: 'Verification link is valid',
      chatbotName: chatbotData?.name || 'Unknown Chatbot',
      token,
      chatbotId,
      userId: validation.userId
    });

  } catch (error: any) {
    console.error('Email verification validation error:', error);
    return NextResponse.json({ 
      error: `Failed to validate verification link: ${error.message}` 
    }, { status: 500 });
  }
}
