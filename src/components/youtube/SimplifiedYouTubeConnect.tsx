// Secure YouTube OAuth Connect Component - Mobile Optimized
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Youtube, CheckCircle, AlertCircle, Loader2, ExternalLink, Smartphone, Monitor } from 'lucide-react';
import { detectDevice, getMobileErrorGuidance, checkBrowserSupport, getMobileUIConfig, handleMobileRedirect } from '@/lib/youtube/mobile-utils';

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
  const [deviceInfo, setDeviceInfo] = useState(detectDevice());
  const [browserSupport, setBrowserSupport] = useState(checkBrowserSupport(detectDevice()));

  // Update device info on mount
  useEffect(() => {
    const device = detectDevice();
    setDeviceInfo(device);
    setBrowserSupport(checkBrowserSupport(device));
  }, []);

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
      
      // Use mobile-optimized redirect
      handleMobileRedirect(authUrl, deviceInfo);
      
    } catch (error) {
      console.error('YouTube connection failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      const guidance = getMobileErrorGuidance(errorMessage, deviceInfo);
      setError(guidance.message);
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

  // Get mobile UI configuration
  const uiConfig = getMobileUIConfig(deviceInfo);

  if (isLoading) {
    return (
      <Card className={uiConfig.cardClass}>
        <CardContent className={uiConfig.spacing}>
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className={`${uiConfig.bodySize} text-muted-foreground`}>
              Checking YouTube connection...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={uiConfig.cardClass}>
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <Youtube className="w-6 h-6 text-red-600 dark:text-red-400" />
          {/* Device indicator */}
          <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1">
            {deviceInfo.isMobile ? (
              <Smartphone className="w-3 h-3 text-muted-foreground" />
            ) : (
              <Monitor className="w-3 h-3 text-muted-foreground" />
            )}
          </div>
        </div>
        <CardTitle className={`${uiConfig.titleSize} font-semibold`}>
          {connectionStatus.isConnected ? 'YouTube Connected' : 'Connect YouTube'}
        </CardTitle>
        {connectionStatus.isConnected && connectionStatus.channelInfo && (
          <p className={`${uiConfig.bodySize} text-muted-foreground mt-2`}>
            Connected to: <span className="font-medium">{connectionStatus.channelInfo.title}</span>
          </p>
        )}
      </CardHeader>

      <CardContent className={uiConfig.spacing}>
        {/* Browser Support Warnings */}
        {browserSupport.warnings.length > 0 && (
          <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/50 dark:border-yellow-800">
            <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <div className="space-y-1">
                {browserSupport.warnings.map((warning, index) => (
                  <p key={index} className={uiConfig.bodySize}>{warning}</p>
                ))}
                {browserSupport.recommendations.map((rec, index) => (
                  <p key={index} className={`${uiConfig.bodySize} font-medium`}>{rec}</p>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Connection Status */}
        {connectionStatus.isConnected && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/50 dark:border-green-800">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className={`text-green-800 dark:text-green-200 ${uiConfig.bodySize}`}>
              Your YouTube account is connected and ready to use.
              {deviceInfo.isMobile && (
                <span className="block mt-1 text-xs">
                  Optimized for {deviceInfo.platform} {deviceInfo.browser}
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Error State */}
        {error && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950/50 dark:border-red-800">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className={`text-red-800 dark:text-red-200 ${uiConfig.bodySize}`}>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Connection Instructions */}
        {!connectionStatus.isConnected && !error && (
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-2">
            <h3 className={`font-medium ${uiConfig.bodySize}`}>
              Secure OAuth 2.0 Authentication:
            </h3>
            <ul className={`${uiConfig.bodySize} text-muted-foreground space-y-1 ml-4 list-disc`}>
              <li>Click "Connect YouTube" below</li>
              {deviceInfo.isMobile ? (
                <>
                  <li>You'll be redirected to Google in your browser</li>
                  <li>Sign in and grant permission to access your videos</li>
                  <li>You'll be automatically returned here</li>
                </>
              ) : (
                <>
                  <li>You'll be securely redirected to Google</li>
                  <li>Grant permission to access your YouTube videos</li>
                  <li>Return here to select videos for your chatbot</li>
                </>
              )}
            </ul>
            {deviceInfo.isMobile && (
              <p className={`${uiConfig.bodySize} text-xs text-muted-foreground mt-2`}>
                Mobile-optimized flow for {deviceInfo.platform}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          {connectionStatus.isConnected ? (
            <Button
              variant="outline"
              onClick={handleDisconnect}
              disabled={isConnecting}
              className={`flex-1 ${uiConfig.buttonClass} ${uiConfig.touchTarget}`}
              size={uiConfig.buttonSize as "sm" | "lg" | "default" | "icon" | null | undefined}
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
              className={`flex-1 bg-red-600 hover:bg-red-700 text-white ${uiConfig.buttonClass} ${uiConfig.touchTarget}`}
              size={uiConfig.buttonSize as "sm" | "lg" | "default" | "icon" | null | undefined}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {deviceInfo.isMobile ? 'Connecting...' : 'Redirecting...'}
                </>
              ) : (
                <>
                  <Youtube className="w-4 h-4 mr-2" />
                  {!deviceInfo.isMobile && <ExternalLink className="w-3 h-3 mr-1" />}
                  {deviceInfo.isMobile ? 'Connect YouTube' : 'Connect YouTube'}
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