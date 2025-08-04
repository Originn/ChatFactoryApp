import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin/index';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Get user tokens from Firestore
    const doc = await adminDb.collection('user_youtube_tokens').doc(userId).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'YouTube account not connected' },
        { status: 404 }
      );
    }

    const data = doc.data();
    
    if (!data?.accessToken) {
      return NextResponse.json(
        { error: 'Invalid token data' },
        { status: 500 }
      );
    }

    // Update last used timestamp
    await adminDb.collection('user_youtube_tokens').doc(userId).update({
      lastUsed: new Date().toISOString()
    });

    return NextResponse.json({
      isConnected: true,
      channelInfo: data.channelInfo,
      connectedAt: data.connectedAt
    });
  } catch (error) {
    console.error('Error getting user YouTube tokens:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}