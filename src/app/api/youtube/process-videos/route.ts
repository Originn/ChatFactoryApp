import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin/index';
import crypto from 'crypto';

// Decryption for stored user tokens
const ENCRYPTION_KEY = process.env.YOUTUBE_KEYS_ENCRYPTION_KEY || 'your-32-character-secret-key-here!!';

function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = textParts.join(':');
  const decipher = crypto.createDecipher('aes-256-cbc', ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
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

    // Create processing job
    const processingJob = {
      id: `youtube-${Date.now()}`,
      type: 'youtube_videos',
      chatbotId,
      userId,
      videoIds,
      isPublic,
      status: 'pending',
      createdAt: new Date().toISOString(),
      progress: 0,
    };

    // Save processing job to Firestore
    await adminDb.collection('video_processing_jobs').doc(processingJob.id).set(processingJob);

    // TODO: Integrate with your existing VideoService or transcription service
    // This would typically:
    // 1. Download audio from YouTube videos using youtube-dl or similar
    // 2. Send to your transcription service (VIDEO_TRANSCRIBER_CPU_URL/VIDEO_TRANSCRIBER_GPU_URL)
    // 3. Generate embeddings
    // 4. Store in your vector database
    // 5. Update the processing job status

    // For now, simulate processing (replace with actual integration)
    setTimeout(async () => {
      try {
        // In real implementation, you would:
        // 1. Use accessToken to get video details
        // 2. Download video audio
        // 3. Send to your existing video transcription service
        // 4. Process results through your embedding pipeline
        
        await adminDb.collection('video_processing_jobs').doc(processingJob.id).update({
          status: 'completed',
          progress: 100,
          completedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error updating processing job:', error);
        await adminDb.collection('video_processing_jobs').doc(processingJob.id).update({
          status: 'error',
          error: 'Processing failed',
          completedAt: new Date().toISOString(),
        });
      }
    }, 5000);

    return NextResponse.json({
      success: true,
      jobId: processingJob.id,
      message: `Started processing ${videoIds.length} videos`
    });
  } catch (error) {
    console.error('Error processing YouTube videos:', error);
    return NextResponse.json(
      { error: 'Failed to process videos' },
      { status: 500 }
    );
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