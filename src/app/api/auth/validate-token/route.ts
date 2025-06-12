import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { token, chatbotId } = await request.json();

    if (!token || !chatbotId) {
      return NextResponse.json(
        { error: 'Token and chatbot ID are required' },
        { status: 400 }
      );
    }

    console.log('🔧 Validating custom token:', token.substring(0, 10) + '...');

    // Get token data from main project
    const tokenDoc = await adminDb
      .collection('passwordResetTokens')
      .doc(token)
      .get();

    if (!tokenDoc.exists) {
      return NextResponse.json(
        { error: 'Invalid or expired setup link' },
        { status: 400 }
      );
    }

    const tokenData = tokenDoc.data();

    // Verify token is valid
    if (tokenData?.used) {
      return NextResponse.json(
        { error: 'This setup link has already been used' },
        { status: 400 }
      );
    }

    if (tokenData?.expiresAt?.toDate() < new Date()) {
      return NextResponse.json(
        { error: 'This setup link has expired' },
        { status: 400 }
      );
    }

    // Verify chatbot ID matches
    if (tokenData?.chatbotId !== chatbotId) {
      return NextResponse.json(
        { error: 'Invalid setup link for this chatbot' },
        { status: 400 }
      );
    }

    console.log('✅ Token validation successful');

    return NextResponse.json({
      success: true,
      email: tokenData?.email,
      userId: tokenData?.userId
    });

  } catch (error: any) {
    console.error('❌ Token validation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
