import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin/index';
import crypto from 'crypto';
import { YouTubeVideo } from '@/types/youtube';

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

/**
 * Format ISO 8601 duration to readable format
 */
function formatDuration(duration: string): string {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return '0:00';

  const hours = parseInt(match[1]?.replace('H', '') || '0');
  const minutes = parseInt(match[2]?.replace('M', '') || '0');
  const seconds = parseInt(match[3]?.replace('S', '') || '0');

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const maxResults = parseInt(searchParams.get('maxResults') || '25');
    const pageToken = searchParams.get('pageToken');
    const searchQuery = searchParams.get('searchQuery');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
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
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'YouTube API key not configured' },
        { status: 500 }
      );
    }

    // First get the channel's upload playlist
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true&key=${apiKey}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!channelResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch channel details' },
        { status: 400 }
      );
    }

    const channelData = await channelResponse.json();
    const uploadsPlaylistId = channelData.items[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) {
      return NextResponse.json({ 
        videos: [], 
        totalResults: 0 
      });
    }

    // Fetch videos from uploads playlist
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: maxResults.toString(),
      key: apiKey
    });

    if (pageToken) {
      params.append('pageToken', pageToken);
    }

    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!videosResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch videos' },
        { status: 400 }
      );
    }

    const videosData = await videosResponse.json();

    // Get detailed video information (including privacy status)
    const videoIds = videosData.items.map((item: any) => item.snippet.resourceId.videoId).join(',');
    
    if (!videoIds) {
      return NextResponse.json({ 
        videos: [], 
        totalResults: 0 
      });
    }

    const videoDetailsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,status&id=${videoIds}&key=${apiKey}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!videoDetailsResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch video details' },
        { status: 400 }
      );
    }

    const videoDetailsData = await videoDetailsResponse.json();

    const videos: YouTubeVideo[] = videoDetailsData.items.map((video: any) => ({
      id: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      thumbnailUrl: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default.url,
      duration: formatDuration(video.contentDetails.duration),
      publishedAt: video.snippet.publishedAt,
      channelTitle: video.snippet.channelTitle,
      viewCount: video.statistics?.viewCount,
      privacy: video.status.privacyStatus === 'public' ? 'public' : 
               video.status.privacyStatus === 'unlisted' ? 'unlisted' : 'private'
    }));

    // Filter by search query if provided
    const filteredVideos = searchQuery 
      ? videos.filter(video => 
          video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          video.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : videos;

    // Update last used timestamp
    await adminDb.collection('user_youtube_tokens').doc(userId).update({
      lastUsed: new Date().toISOString()
    });

    return NextResponse.json({
      videos: filteredVideos,
      nextPageToken: videosData.nextPageToken,
      totalResults: videosData.pageInfo?.totalResults || 0
    });

  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}