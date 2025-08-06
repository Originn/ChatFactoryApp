import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/youtube/oauth-utils';
import { adminDb } from '@/lib/firebase/admin/index';
import { FieldValue } from 'firebase-admin/firestore';
import { fetchYouTubeTranscriptOfficial, getYouTubeVideoMetadata } from '@/lib/youtube/transcriptUtils';

export async function POST(req: NextRequest) {
  try {
    const { videoIds, isPublic, chatbotId, userId } = await req.json();

    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid videoIds parameter' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    if (!chatbotId) {
      return NextResponse.json(
        { error: 'Missing chatbotId parameter' },
        { status: 400 }
      );
    }

    // Get valid access token (auto-refreshes if needed)
    const accessToken = await getValidAccessToken(userId);

    // Create processing job
    const processingJob = {
      id: `yt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'youtube_videos',
      status: 'pending',
      userId,
      chatbotId,
      videoIds,
      isPublic: Boolean(isPublic),
      createdAt: new Date(),
      progress: {
        total: videoIds.length,
        completed: 0,
        failed: 0,
        currentVideo: null,
      }
    };

    // Store processing job
    await adminDb.collection('processing_jobs').doc(processingJob.id).set(processingJob);

    // Get chatbot data
    const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
    if (!chatbotDoc.exists) {
      throw new Error('Chatbot not found');
    }
    const chatbotData = chatbotDoc.data();

    // Start async processing (don't await)
    processYouTubeVideos(processingJob, accessToken, chatbotData).catch(error => {
      console.error('Background video processing failed:', error);
    });

    return NextResponse.json({
      success: true,
      jobId: processingJob.id,
      message: `Started processing ${videoIds.length} YouTube videos`,
    });

  } catch (error) {
    console.error('Error starting YouTube video processing:', error);
    
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
      { error: 'Failed to start video processing' },
      { status: 500 }
    );
  }
}

/**
 * Background processing function for YouTube videos
 */
async function processYouTubeVideos(processingJob: any, accessToken: string, chatbotData: any) {
  try {
    const { id: jobId, videoIds, userId, chatbotId, isPublic } = processingJob;
    
    // Update job status to processing
    await adminDb.collection('processing_jobs').doc(jobId).update({
      status: 'processing',
      startedAt: new Date(),
    });

    const results = [];

    for (let i = 0; i < videoIds.length; i++) {
      const videoId = videoIds[i];
      
      try {
        // Update progress
        await adminDb.collection('processing_jobs').doc(jobId).update({
          'progress.currentVideo': videoId,
          'progress.completed': i,
        });

        // Get video metadata
        const videoMetadata = await getYouTubeVideoMetadata(videoId, accessToken);
        
        if (!videoMetadata) {
          throw new Error('Failed to get video metadata');
        }

        // Get transcript
        const transcript = await fetchYouTubeTranscriptOfficial(videoId, accessToken);
        
        if (!transcript || transcript.length === 0) {
          throw new Error('No transcript available for this video');
        }

        // Combine transcript into text
        const transcriptText = transcript.map(item => item.text).join(' ');

        // Create document entry
        const documentData = {
          id: `youtube_${videoId}`,
          name: videoMetadata.title,
          type: 'youtube_video',
          content: transcriptText,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          metadata: {
            ...videoMetadata,
            videoId,
            transcriptLanguage: 'auto-detected',
            wordCount: transcriptText.split(' ').length,
          },
          chatbotId,
          userId,
          isPublic,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Save document
        await adminDb.collection('documents').doc(documentData.id).set(documentData);

        // Update chatbot document count
        await adminDb.collection('chatbots').doc(chatbotId).update({
          documentCount: FieldValue.increment(1),
          updatedAt: new Date(),
        });

        results.push({
          videoId,
          title: videoMetadata.title,
          status: 'success',
          documentId: documentData.id,
        });

      } catch (error) {
        console.error(`Failed to process video ${videoId}:`, error);
        
        await adminDb.collection('processing_jobs').doc(jobId).update({
          'progress.failed': FieldValue.increment(1),
        });

        results.push({
          videoId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Processing failed',
        });
      }
    }

    // Mark job as completed
    await adminDb.collection('processing_jobs').doc(jobId).update({
      status: 'completed',
      completedAt: new Date(),
      'progress.completed': videoIds.length,
      results,
    });

  } catch (error) {
    console.error('Processing job failed:', error);
    
    // Mark job as failed
    await adminDb.collection('processing_jobs').doc(processingJob.id).update({
      status: 'failed',
      failedAt: new Date(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}