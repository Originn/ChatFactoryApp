import { adminDb } from '@/lib/firebase/admin/index';
import crypto from 'crypto';

export interface TranscriptItem {
  text: string;
  start: number;
  duration: number;
}

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

export async function fetchYouTubeTranscriptOfficial(videoId: string, userId: string): Promise<TranscriptItem[]> {
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

function parseCaptionContent(content: string): TranscriptItem[] {
  const transcriptItems: TranscriptItem[] = [];
  
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

export async function getYouTubeVideoMetadata(videoId: string, accessToken: string) {
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