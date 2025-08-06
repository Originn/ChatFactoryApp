import { NextRequest, NextResponse } from 'next/server';
import { checkUserConnection } from '@/lib/youtube/oauth-utils';

/**
 * Check YouTube connection status for a user
 */
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

    const connectionStatus = await checkUserConnection(userId);

    return NextResponse.json(connectionStatus);

  } catch (error) {
    console.error('Error checking YouTube connection status:', error);
    return NextResponse.json(
      { error: 'Failed to check connection status' },
      { status: 500 }
    );
  }
}