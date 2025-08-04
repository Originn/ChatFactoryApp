import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin/index';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Remove user tokens from Firestore
    await adminDb.collection('user_youtube_tokens').doc(userId).delete();

    return NextResponse.json({
      success: true,
      message: 'YouTube account disconnected successfully'
    });
  } catch (error) {
    console.error('Error disconnecting YouTube account:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}