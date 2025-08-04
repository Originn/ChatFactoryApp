// DEBUG: Simplified YouTube Connect component - no more user API keys needed
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Youtube, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { CentralizedYouTubeService } from '@/services/centralizedYouTubeService';
import { YouTubeAuthState } from '@/types/youtube';

interface SimplifiedYouTubeConnectProps {
  userId: string;
  onConnectionChange?: (isConnected: boolean) => void;
}

export default function SimplifiedYouTubeConnect({
  userId,
  onConnectionChange
}: SimplifiedYouTubeConnectProps) {
  const [authState, setAuthState] = useState<YouTubeAuthState>({ isConnected: false });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const youtubeService = CentralizedYouTubeService.getInstance();

  useEffect(() => {
    youtubeService.setUserId(userId);
    checkConnection();
  }, [userId]);

  const checkConnection = async () => {
    try {
      setIsChecking(true);
      
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      const isConnected = await youtubeService.checkConnection();
      const currentState = youtubeService.getAuthState();
      setAuthState(currentState);
      onConnectionChange?.(isConnected);
    } catch (error) {
      console.error('Error checking YouTube connection:', error);
      setAuthState({ 
        isConnected: false, 
        error: error instanceof Error ? error.message : 'Failed to check connection status'
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setAuthState({ isConnected: false, error: undefined });
      
      if (!userId) {
        throw new Error('User ID is required for YouTube connection');
      }
      
      await youtubeService.connectWithPopup();
      
      const newState = youtubeService.getAuthState();
      setAuthState(newState);
      onConnectionChange?.(newState.isConnected);
      
    } catch (error) {
      console.error('YouTube connection failed:', error);
      setAuthState({
        isConnected: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setIsConnecting(true);
      await youtubeService.disconnect();
      setAuthState({ isConnected: false });
      onConnectionChange?.(false);
    } catch (error) {
      console.error('YouTube disconnect failed:', error);
    } finally {
      setIsConnecting(false);
    }
  };
  if (isChecking) {
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
          {authState.isConnected ? 'YouTube Connected' : 'Connect YouTube'}
        </CardTitle>
        {authState.isConnected && authState.channel && (
          <p className="text-sm text-muted-foreground mt-2">
            Connected to: <span className="font-medium">{authState.channel.title}</span>
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Connection Status */}
        {authState.isConnected && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/50 dark:border-green-800">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Your YouTube account is connected and ready to use.
            </AlertDescription>
          </Alert>
        )}

        {/* Error State */}
        {authState.error && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950/50 dark:border-red-800">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              {authState.error}
            </AlertDescription>
          </Alert>
        )}

        {/* Connection Instructions */}
        {!authState.isConnected && !authState.error && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-2">
            <h3 className="font-medium text-sm">How it works:</h3>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
              <li>Click "Connect YouTube" below</li>
              <li>Sign in with your Google account</li>
              <li>Grant permission to access your YouTube videos</li>
              <li>Select videos to add to your chatbot</li>
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {authState.isConnected ? (
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
                  Connect YouTube
                </>
              )}
            </Button>
          )}
        </div>

        {/* Channel Info */}
        {authState.isConnected && authState.channel && (
          <div className="pt-2 border-t">
            <div className="flex items-center space-x-3">
              {authState.channel.thumbnailUrl && (
                <img
                  src={authState.channel.thumbnailUrl}
                  alt={authState.channel.title}
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{authState.channel.title}</p>
                {authState.channel.subscriberCount && (
                  <p className="text-xs text-muted-foreground">
                    {parseInt(authState.channel.subscriberCount).toLocaleString()} subscribers
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