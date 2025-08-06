// Simplified YouTube Service - authentication removed
'use client';

import { YouTubeVideo, YouTubeChannel } from '@/types/youtube';

/**
 * YouTube Service - Basic video operations without authentication
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