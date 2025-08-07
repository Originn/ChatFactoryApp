import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin/index';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const chatbotId = searchParams.get('chatbotId');
    const userId = searchParams.get('userId');

    if (!chatbotId || !userId) {
      return NextResponse.json(
        { error: 'Missing chatbotId or userId parameter' },
        { status: 400 }
      );
    }

    // Get all processed videos for this chatbot
    const processedVideosSnapshot = await adminDb
      .collection('processed_youtube_videos')
      .where('chatbotId', '==', chatbotId)
      .where('userId', '==', userId)
      .where('status', '==', 'completed')
      .get();

    const processedVideoIds = processedVideosSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        videoId: data.videoId,
        processedAt: data.processedAt,
        vectorCount: data.vectorCount || 0
      };
    });

    return NextResponse.json({
      success: true,
      processedVideos: processedVideoIds
    });
  } catch (error) {
    console.error('Error fetching processed videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch processed videos' },
      { status: 500 }
    );
  }
}