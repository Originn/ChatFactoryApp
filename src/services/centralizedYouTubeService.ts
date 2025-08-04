// DEBUG: Centralized YouTube Service - uses platform API keys for all users
'use client';

import { YouTubeVideo, YouTubeChannel, YouTubeAuthState } from '@/types/youtube';

/**
 * Centralized YouTube Service - Uses platform's API keys
 * Much better UX - users just click "Connect YouTube"
 */
export class CentralizedYouTubeService {
  private static instance: CentralizedYouTubeService;
  private authState: YouTubeAuthState = { isConnected: false };
  private userId: string | null = null;

  static getInstance(): CentralizedYouTubeService {
    if (!CentralizedYouTubeService.instance) {
      CentralizedYouTubeService.instance = new CentralizedYouTubeService();
    }
    return CentralizedYouTubeService.instance;
  }

  /**
   * Set current user ID
   */
  setUserId(userId: string) {
    this.userId = userId;
  }

  /**
   * Get current auth state
   */
  getAuthState(): YouTubeAuthState {
    return this.authState;
  }

  /**
   * Generate YouTube OAuth URL using platform credentials
   */
  async generateAuthUrl(): Promise<string> {
    if (!this.userId) {
      throw new Error('User ID not set');
    }

    try {
      const response = await fetch(`/api/youtube/auth?userId=${this.userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to generate auth URL');
      }

      const data = await response.json();
      return data.authUrl;
    } catch (error) {
      console.error('Error generating auth URL:', error);
      throw error;
    }
  }

  /**
   * Connect to YouTube with popup window
   */
  async connectWithPopup(): Promise<void> {
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
        try {
          if (popup.closed) {
            clearInterval(checkClosed);
            if (!this.authState.isConnected) {
              reject(new Error('Authentication cancelled'));
            }
          }
        } catch (error) {
          // Handle Cross-Origin-Opener-Policy restriction
          console.log('Cannot check popup.closed due to COOP policy');
        }
      }, 1000);

      // Listen for message from popup
      const messageHandler = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        
        // Check if event.data exists and has the expected structure
        if (!event.data || typeof event.data !== 'object') {
          return;
        }
        
        if (event.data.type === 'YOUTUBE_AUTH_SUCCESS') {
          clearInterval(checkClosed);
          try {
            popup.close();
          } catch (error) {
            // Ignore COOP policy error
          }
          window.removeEventListener('message', messageHandler);
          
          try {
            if (!event.data.code || !event.data.userId) {
              throw new Error('Missing authorization code or user ID');
            }
            await this.handleAuthCallback(event.data.code, event.data.userId);
            resolve();
          } catch (error) {
            reject(error);
          }
        } else if (event.data.type === 'YOUTUBE_AUTH_ERROR') {
          clearInterval(checkClosed);
          try {
            popup.close();
          } catch (error) {
            // Ignore COOP policy error
          }
          window.removeEventListener('message', messageHandler);
          reject(new Error(event.data.error || 'Authentication failed'));
        }
      };

      window.addEventListener('message', messageHandler);
      
      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        clearInterval(checkClosed);
        window.removeEventListener('message', messageHandler);
        try {
          popup.close();
        } catch (error) {
          console.log('Cannot close popup due to COOP policy');
        }
        reject(new Error('Authentication timed out after 5 minutes'));
      }, 300000); // 5 minutes
      
      // Clean up timeout when resolved/rejected
      const originalResolve = resolve;
      const originalReject = reject;
      
      resolve = (value) => {
        clearTimeout(timeout);
        originalResolve(value);
      };
      
      reject = (reason) => {
        clearTimeout(timeout);
        originalReject(reason);
      };
    });
  }
  /**
   * Handle OAuth callback and exchange code for tokens
   */
  async handleAuthCallback(code: string, userId: string): Promise<void> {
    try {
      const response = await fetch('/api/youtube/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, userId })
      });

      if (!response.ok) {
        throw new Error('Failed to exchange auth code for tokens');
      }

      const data = await response.json();
      
      this.authState = {
        isConnected: true,
        channel: data.channelInfo
      };

    } catch (error) {
      this.authState = {
        isConnected: false,
        error: error instanceof Error ? error.message : 'Authentication failed'
      };
      throw error;
    }
  }

  /**
   * Check if user has connected YouTube account
   */
  async checkConnection(): Promise<boolean> {
    if (!this.userId) {
      return false;
    }

    try {
      const response = await fetch(`/api/youtube/user-tokens?userId=${this.userId}`);
      
      if (response.ok) {
        const data = await response.json();
        this.authState = {
          isConnected: true,
          channel: data.channelInfo
        };
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking YouTube connection:', error);
      return false;
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
    if (!this.userId) {
      throw new Error('User ID not set');
    }

    try {
      const params = new URLSearchParams({
        userId: this.userId,
        maxResults: maxResults.toString(),
      });

      if (pageToken) params.append('pageToken', pageToken);
      if (searchQuery) params.append('searchQuery', searchQuery);

      const response = await fetch(`/api/youtube/videos?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch videos:', error);
      throw error;
    }
  }

  /**
   * Process selected videos for chatbot training
   */
  async processVideos(videoIds: string[], isPublic: boolean, chatbotId: string): Promise<void> {
    if (!this.userId) {
      throw new Error('User ID not set');
    }

    try {
      const response = await fetch('/api/youtube/process-videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoIds,
          isPublic,
          chatbotId,
          userId: this.userId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start video processing');
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to process videos:', error);
      throw error;
    }
  }

  /**
   * Disconnect from YouTube
   */
  async disconnect(): Promise<void> {
    if (!this.userId) {
      throw new Error('User ID not set');
    }

    try {
      const response = await fetch('/api/youtube/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.userId })
      });

      if (response.ok) {
        this.authState = { isConnected: false };
      }
    } catch (error) {
      console.error('Failed to disconnect YouTube:', error);
      throw error;
    }
  }
}