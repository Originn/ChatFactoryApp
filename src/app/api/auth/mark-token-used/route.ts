import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Mark token as used in main project
    await adminDb.collection('passwordResetTokens').doc(token).update({
      used: true,
      usedAt: new Date()
    });

    console.log('✅ Token marked as used in main project:', token);

    return NextResponse.json({
      success: true,
      message: 'Token marked as used'
    });

  } catch (error: any) {
    console.error('❌ Error marking token as used:', error);
    return NextResponse.json(
      { error: 'Failed to mark token as used' },
      { status: 500 }
    );
  }
}
