import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/youtube/oauth-utils';
import { fetchYouTubeTranscriptOfficial } from '@/lib/youtube/transcriptUtils';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('videoId');
    const userId = searchParams.get('userId');

    if (!videoId) {
      return NextResponse.json(
        { error: 'Missing videoId parameter' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Get valid access token (auto-refreshes if needed)
    const accessToken = await getValidAccessToken(userId);

    // Fetch transcript using the official API
    const transcript = await fetchYouTubeTranscriptOfficial(videoId, accessToken);

    return NextResponse.json({
      transcript,
      videoId,
      success: true,
    });

  } catch (error) {
    console.error('Error fetching YouTube transcript:', error);
    
    if (error instanceof Error && error.message.includes('not connected')) {
      return NextResponse.json(
        { error: 'YouTube account not connected' },
        { status: 404 }
      );
    }
    
    if (error instanceof Error && error.message.includes('refresh failed')) {
      return NextResponse.json(
        { error: 'Authentication expired', requiresReauth: true },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch transcript' },
      { status: 500 }
    );
  }
}