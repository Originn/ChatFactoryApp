import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin/index';
import { FieldValue } from 'firebase-admin/firestore';
import { fetchYouTubeTranscriptOfficial, getYouTubeVideoMetadata } from '@/lib/youtube/transcriptUtils';
import crypto from 'crypto';

// Decryption for stored user tokens
const ENCRYPTION_KEY = process.env.YOUTUBE_KEYS_ENCRYPTION_KEY || 'your-32-character-secret-key-here!!';

function decrypt(text: string): string {
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = textParts.join(':');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt token');
  }
}


export async function POST(req: NextRequest) {
  try {
    const { videoIds, isPublic, chatbotId, userId } = await req.json();

    if (!videoIds || !Array.isArray(videoIds) || !chatbotId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
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

    // Decrypt access token
    const accessToken = decrypt(data.accessToken);

    // Get chatbot configuration
    const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
    if (!chatbotDoc.exists) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    const chatbotData = chatbotDoc.data();
    const firebaseProjectId = chatbotData?.firebaseProjectId || chatbotData?.deployment?.firebaseProjectId;
    
    if (!firebaseProjectId) {
      return NextResponse.json({ error: 'Firebase project not configured for this chatbot' }, { status: 404 });
    }

    // Get vectorstore configuration
    const vectorstore = chatbotData?.vectorstore;
    if (!vectorstore || !vectorstore.indexName) {
      return NextResponse.json({ error: 'Vectorstore not configured for this chatbot' }, { status: 404 });
    }

    // Get AI configuration
    const aiConfig = chatbotData?.aiConfig;
    if (!aiConfig || !aiConfig.embeddingModel) {
      return NextResponse.json({ error: 'AI configuration not found for this chatbot' }, { status: 404 });
    }

    // Create processing job
    const processingJob = {
      id: `youtube-${Date.now()}`,
      type: 'youtube_videos',
      chatbotId,
      userId,
      videoIds,
      isPublic,
      status: 'processing',
      createdAt: new Date().toISOString(),
      progress: 0,
      totalVideos: videoIds.length,
      processedVideos: 0,
      errors: []
    };

    // Save processing job to Firestore
    await adminDb.collection('video_processing_jobs').doc(processingJob.id).set(processingJob);

    // Process videos asynchronously
    processYouTubeVideos(processingJob, accessToken, chatbotData);

    return NextResponse.json({
      success: true,
      jobId: processingJob.id,
      message: `Started processing ${videoIds.length} YouTube videos`
    });
  } catch (error) {
    console.error('Error processing YouTube videos:', error);
    return NextResponse.json(
      { error: 'Failed to process videos' },
      { status: 500 }
    );
  }
}

// Async function to process YouTube videos
async function processYouTubeVideos(processingJob: any, accessToken: string, chatbotData: any) {
  try {
    
    const { VideoService } = await import('@/services/videoService');
    let processedCount = 0;
    let totalVectorCount = 0;
    const errors: any[] = [];

    for (const videoId of processingJob.videoIds) {
      try {
        // Update progress
        await adminDb.collection('video_processing_jobs').doc(processingJob.id).update({
          progress: Math.round((processedCount / processingJob.totalVideos) * 100),
          currentVideo: videoId
        });

        // Get video metadata
        const videoMetadata = await getYouTubeVideoMetadata(videoId, accessToken);

        // Get transcript
        const transcript = await fetchYouTubeTranscriptOfficial(videoId, processingJob.userId);

        // Process with VideoService
        const result = await VideoService.processYouTubeTranscript({
          transcript: transcript,
          videoId: videoId,
          videoMetadata: videoMetadata,
          chatbotId: processingJob.chatbotId,
          userId: processingJob.userId,
          firebaseProjectId: chatbotData.firebaseProjectId || chatbotData.deployment?.firebaseProjectId,
          isPublic: processingJob.isPublic,
          embeddingModel: chatbotData.aiConfig.embeddingModel,
          pineconeIndex: chatbotData.vectorstore.indexName,
          pineconeNamespace: chatbotData.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || undefined,
          enableProcessing: true
        });

        if (result.success) {
          totalVectorCount += result.vectorCount || 0;
        } else {
          errors.push({ videoId, error: result.error });
        }

        processedCount++;

      } catch (error) {
        errors.push({ videoId, error: error instanceof Error ? error.message : 'Unknown error' });
        processedCount++;
      }
    }

    // Update document count if vectors were created
    if (totalVectorCount > 0) {
      await adminDb.collection('chatbots').doc(processingJob.chatbotId).update({
        'vectorstore.documentCount': FieldValue.increment(processedCount - errors.length)
      });
    }

    // Mark job as completed
    await adminDb.collection('video_processing_jobs').doc(processingJob.id).update({
      status: errors.length === processingJob.totalVideos ? 'error' : 'completed',
      progress: 100,
      processedVideos: processedCount,
      totalVectorCount: totalVectorCount,
      errors: errors,
      completedAt: new Date().toISOString(),
    });


  } catch (error) {
    console.error('Error in YouTube video processing:', error);
    await adminDb.collection('video_processing_jobs').doc(processingJob.id).update({
      status: 'error',
      error: 'Processing pipeline failed',
      completedAt: new Date().toISOString(),
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId parameter' },
        { status: 400 }
      );
    }

    const doc = await adminDb.collection('video_processing_jobs').doc(jobId).get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: 'Processing job not found' },
        { status: 404 }
      );
    }

    const job = doc.data();
    return NextResponse.json(job);
  } catch (error) {
    console.error('Error getting processing job status:', error);
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}