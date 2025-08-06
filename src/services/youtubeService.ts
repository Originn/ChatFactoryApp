'use client';

import { YouTubeVideo, YouTubeChannel, YouTubeApiKeys, YouTubeAuthState } from '@/types/youtube';
import { isMobileDevice, isPopupLikelyBlocked } from '@/lib/utils';

/**
 * YouTube Service with user-provided API keys
 * Handles authentication, video fetching, and processing
 */
export class YouTubeService {
  private static instance: YouTubeService;
  private apiKeys: YouTubeApiKeys | null = null;
  private authState: YouTubeAuthState = { isConnected: false };

  static getInstance(): YouTubeService {
    if (!YouTubeService.instance) {
      YouTubeService.instance = new YouTubeService();
    }
    return YouTubeService.instance;
  }

  /**
   * Set user-provided API keys
   */
  setApiKeys(keys: YouTubeApiKeys) {
    this.apiKeys = keys;
  }

  /**
   * Get current API keys
   */
  getApiKeys(): YouTubeApiKeys | null {
    return this.apiKeys;
  }

  /**
   * Get current auth state
   */
  getAuthState(): YouTubeAuthState {
    return this.authState;
  }

  /**
   * Generate YouTube OAuth URL for user authorization
   */
  async generateAuthUrl(): Promise<string> {
    if (!this.apiKeys) {
      throw new Error('API keys not configured');
    }

    const scope = 'https://www.googleapis.com/auth/youtube.readonly';
    const redirectUri = `${window.location.origin}/api/youtube/callback`;
    
    const params = new URLSearchParams({
      client_id: this.apiKeys.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scope,
      access_type: 'offline',
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleAuthCallback(code: string): Promise<void> {
    if (!this.apiKeys) {
      throw new Error('API keys not configured');
    }

    try {
      const response = await fetch('/api/youtube/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          clientId: this.apiKeys.clientId,
          clientSecret: this.apiKeys.clientSecret,
          redirectUri: `${window.location.origin}/api/youtube/callback`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to exchange auth code for tokens');
      }

      const tokens = await response.json();
      
      this.authState = {
        isConnected: true,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token
      };

      // Fetch user's channel info
      await this.fetchChannelInfo();
    } catch (error) {
      this.authState = {
        isConnected: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
      throw error;
    }
  }

  /**
   * Connect to YouTube - uses redirect flow on mobile, popup on desktop
   */
  async connectWithPopup(): Promise<void> {
    // Use redirect flow on mobile devices to avoid popup blockers
    if (isPopupLikelyBlocked()) {
      return this.connectWithRedirect();
    }
    
    // Try popup flow first, fall back to redirect if blocked
    try {
      await this.connectWithPopupWindow();
    } catch (error) {
      // If popup was blocked, try redirect flow as fallback
      if (error instanceof Error && error.message.includes('Popup blocked')) {
        console.log('Popup blocked, falling back to redirect flow');
        return this.connectWithRedirect();
      }
      throw error;
    }
  }

  /**
   * Connect using redirect flow (mobile-friendly)
   */
  private async connectWithRedirect(): Promise<void> {
    const authUrl = await this.generateAuthUrl();
    
    // Store current location to return to after auth
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('youtube_legacy_auth_redirect_url', window.location.href);
      sessionStorage.setItem('youtube_legacy_auth_keys', JSON.stringify(this.apiKeys));
      
      // Redirect to auth URL
      window.location.href = authUrl;
    }
    
    // This promise will never resolve because we're redirecting
    return new Promise(() => {});
  }

  /**
   * Connect using popup window (desktop)
   */
  private async connectWithPopupWindow(): Promise<void> {
    const authUrl = await this.generateAuthUrl();
    
    return new Promise((resolve, reject) => {
      const popup = window.open(
        authUrl,
        'youtube-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for this site.'));
        return;
      }

      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          if (!this.authState.isConnected) {
            reject(new Error('Authentication cancelled'));
          }
        }
      }, 1000);

      // Listen for message from popup
      const messageHandler = async (event: MessageEvent) => {
        // Allow messages from current origin or configured app URL
        const allowedOrigins = [
          window.location.origin,
          process.env.NEXT_PUBLIC_APP_URL,
          'http://localhost:3000',
          'https://wizechat.ai'
        ].filter(Boolean);
        
        if (!allowedOrigins.includes(event.origin)) {
          console.log('Ignoring message from unauthorized origin:', event.origin);
          return;
        }
        
        if (event.data.type === 'YOUTUBE_AUTH_SUCCESS') {
          clearInterval(checkClosed);
          popup.close();
          window.removeEventListener('message', messageHandler);
          
          try {
            await this.handleAuthCallback(event.data.code);
            resolve();
          } catch (error) {
            reject(error);
          }
        } else if (event.data.type === 'YOUTUBE_AUTH_ERROR') {
          clearInterval(checkClosed);
          popup.close();
          window.removeEventListener('message', messageHandler);
          reject(new Error(event.data.error || 'Authentication failed'));
        }
      };

      window.addEventListener('message', messageHandler);
    });
  }

  /**
   * Fetch user's channel information
   */
  async fetchChannelInfo(): Promise<void> {
    if (!this.authState.accessToken || !this.apiKeys) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true&key=${this.apiKeys.apiKey}`,
        {
          headers: {
            'Authorization': `Bearer ${this.authState.accessToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch channel info');
      }

      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const channel = data.items[0];
        this.authState.channel = {
          id: channel.id,
          title: channel.snippet.title,
          description: channel.snippet.description,
          thumbnailUrl: channel.snippet.thumbnails.default.url,
          subscriberCount: channel.statistics?.subscriberCount
        };
      }
    } catch (error) {
      console.error('Failed to fetch channel info:', error);
    }
  }

  /**
   * Fetch user's videos with pagination and search
   */
  async fetchVideos({
    maxResults = 25,
    pageToken,
    searchQuery
  }: {
    maxResults?: number;
    pageToken?: string;
    searchQuery?: string;
  } = {}): Promise<{
    videos: YouTubeVideo[];
    nextPageToken?: string;
    totalResults: number;
  }> {
    if (!this.authState.accessToken || !this.apiKeys) {
      throw new Error('Not authenticated');
    }

    try {
      // First get the channel's upload playlist
      const channelResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true&key=${this.apiKeys.apiKey}`,
        {
          headers: {
            'Authorization': `Bearer ${this.authState.accessToken}`
          }
        }
      );

      if (!channelResponse.ok) {
        throw new Error('Failed to fetch channel details');
      }

      const channelData = await channelResponse.json();
      const uploadsPlaylistId = channelData.items[0]?.contentDetails?.relatedPlaylists?.uploads;

      if (!uploadsPlaylistId) {
        return { videos: [], totalResults: 0 };
      }

      // Fetch videos from uploads playlist
      const params = new URLSearchParams({
        part: 'snippet,contentDetails',
        playlistId: uploadsPlaylistId,
        maxResults: maxResults.toString(),
        key: this.apiKeys.apiKey
      });

      if (pageToken) {
        params.append('pageToken', pageToken);
      }

      const videosResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.authState.accessToken}`
          }
        }
      );

      if (!videosResponse.ok) {
        throw new Error('Failed to fetch videos');
      }

      const videosData = await videosResponse.json();

      // Get detailed video information (including privacy status)
      const videoIds = videosData.items.map((item: any) => item.snippet.resourceId.videoId).join(',');
      
      const videoDetailsResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics,status&id=${videoIds}&key=${this.apiKeys.apiKey}`,
        {
          headers: {
            'Authorization': `Bearer ${this.authState.accessToken}`
          }
        }
      );

      const videoDetailsData = await videoDetailsResponse.json();

      const videos: YouTubeVideo[] = videoDetailsData.items.map((video: any) => ({
        id: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        thumbnailUrl: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.default.url,
        duration: this.formatDuration(video.contentDetails.duration),
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

      return {
        videos: filteredVideos,
        nextPageToken: videosData.nextPageToken,
        totalResults: videosData.pageInfo?.totalResults || 0
      };
    } catch (error) {
      console.error('Failed to fetch videos:', error);
      throw error;
    }
  }

  /**
   * Process selected videos for chatbot training
   */
  async processVideos(videoIds: string[], isPublic: boolean, chatbotId: string, userId: string): Promise<void> {
    if (!this.authState.accessToken) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch('/api/youtube/process-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoIds,
          isPublic,
          chatbotId,
          userId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to start video processing');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to process videos:', error);
      throw error;
    }
  }

  /**
   * Format ISO 8601 duration to readable format
   */
  private formatDuration(duration: string): string {
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

  /**
   * Disconnect from YouTube
   */
  disconnect(): void {
    this.authState = { isConnected: false };
    this.apiKeys = null;
  }

  /**
   * Save API keys to user's account (encrypted)
   */
  async saveApiKeys(keys: YouTubeApiKeys, userId: string): Promise<void> {
    try {
      const response = await fetch('/api/youtube/save-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys, userId })
      });

      if (!response.ok) {
        throw new Error('Failed to save API keys');
      }
    } catch (error) {
      console.error('Failed to save API keys:', error);
      throw error;
    }
  }

  /**
   * Load API keys from user's account
   */
  async loadApiKeys(userId: string): Promise<YouTubeApiKeys | null> {
    try {
      const response = await fetch(`/api/youtube/load-keys?userId=${userId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No keys saved
        }
        throw new Error('Failed to load API keys');
      }

      const data = await response.json();
      return data.keys;
    } catch (error) {
      console.error('Failed to load API keys:', error);
      return null;
    }
  }
}