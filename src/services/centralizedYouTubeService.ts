// Secure YouTube OAuth Service - 2025 best practices implementation
'use client';

import { YouTubeVideo, YouTubeChannel } from '@/types/youtube';

interface YouTubeConnectionStatus {
  isConnected: boolean;
  channelInfo?: {
    id: string;
    title: string;
    description?: string;
    thumbnailUrl?: string;
    subscriberCount?: string;
  };
  error?: string;
}

/**
 * YouTube Service - Secure OAuth-based operations following 2025 best practices
 * Uses PKCE, secure token storage, and proper error handling
 */
export class CentralizedYouTubeService {
  private static instance: CentralizedYouTubeService;
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
   * Check if user has valid YouTube connection
   */
  async checkConnection(): Promise<YouTubeConnectionStatus> {
    if (!this.userId) {
      return { isConnected: false, error: 'User ID not set' };
    }

    try {
      const response = await fetch(`/api/youtube/oauth/status?userId=${this.userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to check connection status');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error checking YouTube connection:', error);
      return {
        isConnected: false,
        error: error instanceof Error ? error.message : 'Connection check failed'
      };
    }
  }

  /**
   * Initiate YouTube OAuth connection
   */
  async initiateConnection(): Promise<string> {
    if (!this.userId) {
      throw new Error('User ID not set');
    }

    const response = await fetch('/api/youtube/oauth/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: this.userId })
    });

    if (!response.ok) {
      throw new Error('Failed to initiate YouTube connection');
    }

    const { authUrl } = await response.json();
    return authUrl;
  }

  /**
   * Disconnect YouTube account
   */
  async disconnect(): Promise<void> {
    if (!this.userId) {
      throw new Error('User ID not set');
    }

    const response = await fetch('/api/youtube/oauth/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: this.userId })
    });

    if (!response.ok) {
      throw new Error('Failed to disconnect YouTube account');
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

}