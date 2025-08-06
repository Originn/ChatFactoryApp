import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/youtube/oauth-utils';
import { YouTubeVideo } from '@/types/youtube';

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

    // Get valid access token (auto-refreshes if needed)
    const accessToken = await getValidAccessToken(userId);

    // Base parameters for YouTube API
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      maxResults: maxResults.toString(),
      order: 'date',
      type: 'video'
    });

    if (pageToken) {
      params.append('pageToken', pageToken);
    }

    let videosData;

    if (searchQuery && searchQuery.trim()) {
      // Search for videos matching the query
      params.append('q', searchQuery);
      params.append('forMine', 'true'); // Only search within user's own videos
      
      const searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!searchResponse.ok) {
        throw new Error('Failed to search YouTube videos');
      }

      videosData = await searchResponse.json();
      
      // Get detailed video information for search results
      if (videosData.items && videosData.items.length > 0) {
        const videoIds = videosData.items.map((item: any) => item.id.videoId).join(',');
        
        const detailsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );

        if (detailsResponse.ok) {
          const detailsData = await detailsResponse.json();
          videosData.items = detailsData.items;
        }
      }
    } else {
      // Get all videos from the user's channel
      params.append('forMine', 'true');
      
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch YouTube videos');
      }

      videosData = await response.json();

      // Get detailed video information
      if (videosData.items && videosData.items.length > 0) {
        const videoIds = videosData.items.map((item: any) => item.id.videoId).join(',');
        
        const detailsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoIds}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          }
        );

        if (detailsResponse.ok) {
          const detailsData = await detailsResponse.json();
          videosData.items = detailsData.items;
        }
      }
    }

    // Transform the data
    const videos: YouTubeVideo[] = (videosData.items || []).map((item: any) => ({
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnailUrl: item.snippet.thumbnails.medium?.url,
      publishedAt: item.snippet.publishedAt,
      duration: formatDuration(item.contentDetails?.duration || 'PT0S'),
      viewCount: parseInt(item.statistics?.viewCount || '0'),
      channelTitle: item.snippet.channelTitle
    }));

    return NextResponse.json({
      videos,
      nextPageToken: videosData.nextPageToken,
      totalResults: videosData.pageInfo?.totalResults || videos.length
    });

  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    
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
      { error: 'Failed to fetch videos' },
      { status: 500 }
    );
  }
}