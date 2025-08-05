import { NextRequest, NextResponse } from 'next/server';
import { fetchYouTubeTranscriptOfficial, TranscriptItem } from '@/lib/youtube/transcriptUtils';


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

    // Use the official YouTube Data API
    const transcript = await fetchYouTubeTranscriptOfficial(videoId, userId);
    
    return NextResponse.json({
      success: true,
      transcript,
      totalItems: transcript.length
    });

  } catch (error) {
    console.error('Error in transcript endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transcript', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}