// DEBUG: Centralized YouTube Service - uses platform API keys for all users
'use client';

import { YouTubeVideo, YouTubeChannel, YouTubeAuthState } from '@/types/youtube';
import { isMobileDevice, isPopupLikelyBlocked } from '@/lib/utils';

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
  async generateAuthUrl(isRedirectFlow: boolean = false): Promise<string> {
    if (!this.userId) {
      throw new Error('User ID not set');
    }

    try {
      const params = new URLSearchParams({
        userId: this.userId
      });
      
      if (isRedirectFlow) {
        params.append('redirect', 'true');
      }
      
      const response = await fetch(`/api/youtube/auth?${params.toString()}`);
      
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
    const authUrl = await this.generateAuthUrl(true);
    
    // Store current location to return to after auth
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('youtube_auth_redirect_url', window.location.href);
      sessionStorage.setItem('youtube_auth_user_id', this.userId || '');
      
      // Redirect to auth URL
      window.location.href = authUrl;
    }
    
    // This promise will never resolve because we're redirecting
    // The auth will be handled when the user returns from the callback
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
   * Check if we're returning from a redirect auth flow and handle it
   */
  async handleRedirectCallback(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    // Check if this is a YouTube auth callback
    if (!code && !error) {
      return false;
    }

    // Clear URL parameters
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('state');
    url.searchParams.delete('error');
    window.history.replaceState({}, '', url.toString());

    if (error) {
      console.error('YouTube auth error:', error);
      this.authState = {
        isConnected: false,
        error: `Authentication failed: ${error}`
      };
      return false;
    }

    if (code) {
      try {
        // Get stored user ID
        const storedUserId = sessionStorage.getItem('youtube_auth_user_id');
        if (!storedUserId) {
          throw new Error('Missing user ID from redirect flow');
        }

        // Handle the auth callback
        await this.handleAuthCallback(code, storedUserId);

        // Clean up session storage
        sessionStorage.removeItem('youtube_auth_redirect_url');
        sessionStorage.removeItem('youtube_auth_user_id');

        return true;
      } catch (error) {
        console.error('Error handling redirect callback:', error);
        this.authState = {
          isConnected: false,
          error: error instanceof Error ? error.message : 'Authentication failed'
        };
      }
    }

    return false;
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