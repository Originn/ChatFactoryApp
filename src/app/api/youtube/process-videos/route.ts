import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin/index';
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

// Function to get YouTube video metadata
async function getYouTubeVideoMetadata(videoId: string, accessToken: string) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  
  if (!apiKey) {
    throw new Error('YouTube API key not configured');
  }

  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${apiKey}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch video metadata: ${response.status}`);
  }

  const data = await response.json();
  if (!data.items || data.items.length === 0) {
    throw new Error('Video not found');
  }

  const video = data.items[0];
  return {
    id: video.id,
    title: video.snippet.title,
    description: video.snippet.description,
    duration: video.contentDetails.duration,
    publishedAt: video.snippet.publishedAt,
    viewCount: video.statistics.viewCount,
    thumbnailUrl: video.snippet.thumbnails?.medium?.url
  };
}

// Function to fetch YouTube transcript for a video
async function fetchYouTubeTranscriptOfficial(videoId: string, userId: string): Promise<any[]> {
  try {
    console.log(`Official API: Attempting to fetch transcript for video: ${videoId}`);
    
    // Get user tokens from Firestore
    const doc = await adminDb.collection('user_youtube_tokens').doc(userId).get();
    if (!doc.exists) {
      throw new Error('YouTube account not connected');
    }

    const data = doc.data();
    if (!data?.accessToken) {
      throw new Error('Invalid token data');
    }

    // Decrypt access token
    const accessToken = decrypt(data.accessToken);
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      throw new Error('YouTube API key not configured');
    }

    // Step 1: List available captions for this video
    console.log('Step 1: Listing available captions...');
    const captionsListResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/captions?part=id,snippet&videoId=${videoId}&key=${apiKey}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!captionsListResponse.ok) {
      const errorText = await captionsListResponse.text();
      console.error('Captions list failed:', { status: captionsListResponse.status, error: errorText });
      throw new Error(`Failed to list captions: ${captionsListResponse.status}`);
    }

    const captionsData = await captionsListResponse.json();
    console.log(`Found ${captionsData.items?.length || 0} caption tracks`);

    if (!captionsData.items || captionsData.items.length === 0) {
      throw new Error('No caption tracks found for this video');
    }

    // Get the first caption track (prefer non-auto-generated)
    const captionTrack = captionsData.items.find((item: any) => item.snippet.trackKind !== 'ASR') || captionsData.items[0];
    const captionId = captionTrack.id;
    
    console.log(`Step 2: Downloading caption track: ${captionId} (${captionTrack.snippet.language})`);

    // Step 2: Download the caption track
    const captionDownloadResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/captions/${captionId}?key=${apiKey}&tfmt=ttml`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!captionDownloadResponse.ok) {
      const errorText = await captionDownloadResponse.text();
      console.error('Caption download failed:', { status: captionDownloadResponse.status, error: errorText });
      throw new Error(`Failed to download captions: ${captionDownloadResponse.status}`);
    }

    const captionContent = await captionDownloadResponse.text();
    console.log(`Downloaded caption content, length: ${captionContent.length}`);

    // Step 3: Parse the TTML/XML content
    const transcriptItems = parseCaptionContent(captionContent);
    console.log(`Parsed ${transcriptItems.length} transcript items from official API`);

    return transcriptItems;
  } catch (error) {
    console.error('Official API transcript fetch failed:', error);
    throw error;
  }
}

function parseCaptionContent(content: string): any[] {
  const transcriptItems: any[] = [];
  
  try {
    // Helper function to clean text content
    const cleanText = (text: string): string => {
      return text
        .replace(/<[^>]*>/g, ' ') // Remove any inner HTML tags
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    // Try parsing TTML format with begin and dur attributes
    const ttmlRegex = /<p[^>]*begin="([^"]*)"[^>]*dur="([^"]*)"[^>]*>([\s\S]*?)<\/p>/g;
    let match;
    
    while ((match = ttmlRegex.exec(content)) !== null) {
      const startTime = parseTimeToSeconds(match[1]);
      const duration = parseTimeToSeconds(match[2]);
      const text = cleanText(match[3]);

      if (text) {
        transcriptItems.push({
          start: startTime,
          duration: duration,
          text: text
        });
      }
    }

    // If TTML parsing didn't work, try TTML with begin and end attributes
    if (transcriptItems.length === 0) {
      const ttmlBeginEndRegex = /<p[^>]*begin="([^"]*)"[^>]*end="([^"]*)"[^>]*>([\s\S]*?)<\/p>/g;
      
      while ((match = ttmlBeginEndRegex.exec(content)) !== null) {
        const startTime = parseTimeToSeconds(match[1]);
        const endTime = parseTimeToSeconds(match[2]);
        const duration = endTime - startTime;
        const text = cleanText(match[3]);

        if (text) {
          transcriptItems.push({
            start: startTime,
            duration: duration,
            text: text
          });
        }
      }
    }

    return transcriptItems;
  } catch (error) {
    console.error('Error parsing caption content:', error);
    return [];
  }
}

function parseTimeToSeconds(timeString: string): number {
  // Parse time formats like "00:00:01.500" or "1.5s"
  if (timeString.includes(':')) {
    const parts = timeString.split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (timeString.endsWith('s')) {
    return parseFloat(timeString.replace('s', ''));
  } else {
    return parseFloat(timeString);
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
    console.log(`🎬 Starting YouTube video processing for job: ${processingJob.id}`);
    
    const { VideoService } = await import('@/services/videoService');
    let processedCount = 0;
    let totalVectorCount = 0;
    const errors: any[] = [];

    for (const videoId of processingJob.videoIds) {
      try {
        console.log(`📹 Processing YouTube video: ${videoId}`);
        
        // Update progress
        await adminDb.collection('video_processing_jobs').doc(processingJob.id).update({
          progress: Math.round((processedCount / processingJob.totalVideos) * 100),
          currentVideo: videoId
        });

        // Get video metadata
        const videoMetadata = await getYouTubeVideoMetadata(videoId, accessToken);
        console.log(`📝 Video metadata: ${videoMetadata.title}`);

        // Get transcript
        const transcript = await fetchYouTubeTranscriptOfficial(videoId, processingJob.userId);
        console.log(`📄 Transcript fetched: ${transcript.length} segments`);

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
          console.log(`✅ YouTube video processed: ${videoId} (${result.vectorCount} vectors)`);
        } else {
          errors.push({ videoId, error: result.error });
          console.error(`❌ Failed to process YouTube video ${videoId}: ${result.error}`);
        }

        processedCount++;

      } catch (error) {
        errors.push({ videoId, error: error instanceof Error ? error.message : 'Unknown error' });
        console.error(`❌ Error processing YouTube video ${videoId}:`, error);
        processedCount++;
      }
    }

    // Update document count if vectors were created
    if (totalVectorCount > 0) {
      await adminDb.collection('chatbots').doc(processingJob.chatbotId).update({
        'vectorstore.documentCount': adminDb.FieldValue.increment(processedCount - errors.length)
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

    console.log(`🎉 YouTube processing job completed: ${processingJob.id} (${totalVectorCount} total vectors)`);

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