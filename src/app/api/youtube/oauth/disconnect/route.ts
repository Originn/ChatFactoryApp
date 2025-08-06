import { NextRequest, NextResponse } from 'next/server';
import { disconnectUser } from '@/lib/youtube/oauth-utils';

/**
 * Disconnect YouTube account for a user
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    await disconnectUser(userId);

    return NextResponse.json({
      success: true,
      message: 'YouTube account disconnected successfully',
    });

  } catch (error) {
    console.error('Error disconnecting YouTube account:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect YouTube account' },
      { status: 500 }
    );
  }
}