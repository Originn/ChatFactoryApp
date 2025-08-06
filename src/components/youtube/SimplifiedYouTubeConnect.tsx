// Secure YouTube OAuth Connect Component
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Youtube, CheckCircle, AlertCircle, Loader2, ExternalLink } from 'lucide-react';

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

interface SimplifiedYouTubeConnectProps {
  userId: string;
  onConnectionChange?: (isConnected: boolean) => void;
}

export default function SimplifiedYouTubeConnect({
  userId,
  onConnectionChange
}: SimplifiedYouTubeConnectProps) {
  const [connectionStatus, setConnectionStatus] = useState<YouTubeConnectionStatus>({ isConnected: false });
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for OAuth callback results in URL parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const youtubeSuccess = urlParams.get('youtube_success');
      const youtubeError = urlParams.get('youtube_error');
      
      if (youtubeSuccess === 'true') {
        // Clean URL and refresh connection status
        const url = new URL(window.location.href);
        url.searchParams.delete('youtube_success');
        window.history.replaceState({}, '', url.toString());
        
        // Refresh connection status after successful OAuth
        setTimeout(() => {
          checkConnectionStatus();
        }, 1000);
      }
      
      if (youtubeError) {
        setError(decodeURIComponent(youtubeError));
        
        // Clean URL
        const url = new URL(window.location.href);
        url.searchParams.delete('youtube_error');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, []);

  // Check connection status on component mount
  useEffect(() => {
    if (userId) {
      checkConnectionStatus();
    }
  }, [userId]);

  const checkConnectionStatus = async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(`/api/youtube/oauth/status?userId=${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to check connection status');
      }
      
      const status: YouTubeConnectionStatus = await response.json();
      setConnectionStatus(status);
      onConnectionChange?.(status.isConnected);
      
    } catch (error) {
      console.error('Error checking YouTube connection:', error);
      setError(error instanceof Error ? error.message : 'Failed to check connection');
      setConnectionStatus({ isConnected: false });
      onConnectionChange?.(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!userId) {
      setError('User ID is required for YouTube connection');
      return;
    }
    
    try {
      setIsConnecting(true);
      setError(null);
      
      // Initiate OAuth flow
      const response = await fetch('/api/youtube/oauth/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        throw new Error('Failed to initiate YouTube connection');
      }

      const { authUrl } = await response.json();
      
      // Redirect to Google OAuth
      window.location.href = authUrl;
      
    } catch (error) {
      console.error('YouTube connection failed:', error);
      setError(error instanceof Error ? error.message : 'Connection failed');
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!userId) return;
    
    try {
      setIsConnecting(true);
      setError(null);
      
      const response = await fetch('/api/youtube/oauth/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect YouTube account');
      }

      setConnectionStatus({ isConnected: false });
      onConnectionChange?.(false);
      
    } catch (error) {
      console.error('YouTube disconnect failed:', error);
      setError(error instanceof Error ? error.message : 'Disconnect failed');
    } finally {
      setIsConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Checking YouTube connection...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <Youtube className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <CardTitle className="text-xl font-semibold">
          {connectionStatus.isConnected ? 'YouTube Connected' : 'Connect YouTube'}
        </CardTitle>
        {connectionStatus.isConnected && connectionStatus.channelInfo && (
          <p className="text-sm text-muted-foreground mt-2">
            Connected to: <span className="font-medium">{connectionStatus.channelInfo.title}</span>
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Connection Status */}
        {connectionStatus.isConnected && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/50 dark:border-green-800">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Your YouTube account is connected and ready to use.
            </AlertDescription>
          </Alert>
        )}

        {/* Error State */}
        {error && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950/50 dark:border-red-800">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Connection Instructions */}
        {!connectionStatus.isConnected && !error && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-2">
            <h3 className="font-medium text-sm">Secure OAuth 2.0 Authentication:</h3>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
              <li>Click "Connect YouTube" below</li>
              <li>You'll be securely redirected to Google</li>
              <li>Grant permission to access your YouTube videos</li>
              <li>Return here to select videos for your chatbot</li>
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {connectionStatus.isConnected ? (
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={isConnecting}
              className="flex-1"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                'Disconnect YouTube'
              )}
            </Button>
          ) : (
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Youtube className="w-4 h-4 mr-2" />
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Connect YouTube
                </>
              )}
            </Button>
          )}
        </div>

        {/* Channel Info */}
        {connectionStatus.isConnected && connectionStatus.channelInfo && (
          <div className="pt-2 border-t">
            <div className="flex items-center space-x-3">
              {connectionStatus.channelInfo.thumbnailUrl && (
                <img
                  src={connectionStatus.channelInfo.thumbnailUrl}
                  alt={connectionStatus.channelInfo.title}
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{connectionStatus.channelInfo.title}</p>
                {connectionStatus.channelInfo.subscriberCount && (
                  <p className="text-xs text-muted-foreground">
                    {parseInt(connectionStatus.channelInfo.subscriberCount).toLocaleString()} subscribers
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}