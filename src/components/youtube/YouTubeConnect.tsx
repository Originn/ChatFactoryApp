'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Play, User, Settings, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { YouTubeService } from '@/services/youtubeService';
import { YouTubeApiKeys, YouTubeAuthState } from '@/types/youtube';
import { useAuth } from '@/contexts/AuthContext';
import YouTubeApiKeysForm from './YouTubeApiKeysForm';

interface YouTubeConnectProps {
  onConnectionChange: (isConnected: boolean) => void;
}

export default function YouTubeConnect({ onConnectionChange }: YouTubeConnectProps) {
  const { user } = useAuth();
  const [authState, setAuthState] = useState<YouTubeAuthState>({ isConnected: false });
  const [showApiKeysForm, setShowApiKeysForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const youtubeService = YouTubeService.getInstance();

  useEffect(() => {
    loadSavedApiKeys();
  }, [user]);

  useEffect(() => {
    setAuthState(youtubeService.getAuthState());
    onConnectionChange(youtubeService.getAuthState().isConnected);
  }, [onConnectionChange]);

  const loadSavedApiKeys = async () => {
    if (!user?.uid) return;

    try {
      setIsLoading(true);
      const savedKeys = await youtubeService.loadApiKeys(user.uid);
      
      if (savedKeys) {
        youtubeService.setApiKeys(savedKeys);
        setShowApiKeysForm(false);
      } else {
        setShowApiKeysForm(true);
      }
    } catch (error) {
      console.error('Failed to load saved API keys:', error);
      setShowApiKeysForm(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApiKeysSubmit = async (keys: YouTubeApiKeys) => {
    if (!user?.uid) return;

    try {
      setIsLoading(true);
      setError(null);

      // Save API keys
      await youtubeService.saveApiKeys(keys, user.uid);
      
      // Set API keys in service
      youtubeService.setApiKeys(keys);
      
      setShowApiKeysForm(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save API keys');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await youtubeService.connectWithPopup();
      
      const newAuthState = youtubeService.getAuthState();
      setAuthState(newAuthState);
      onConnectionChange(newAuthState.isConnected);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      setError(errorMessage);
      setAuthState({ isConnected: false, error: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    youtubeService.disconnect();
    const newAuthState = youtubeService.getAuthState();
    setAuthState(newAuthState);
    onConnectionChange(newAuthState.isConnected);
  };

  const handleReconfigure = () => {
    setShowApiKeysForm(true);
    setError(null);
  };

  if (isLoading && !showApiKeysForm) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-3">
            <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-sm text-muted-foreground">Loading YouTube connection...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (showApiKeysForm) {
    return (
      <YouTubeApiKeysForm
        onKeysSubmit={handleApiKeysSubmit}
        onCancel={() => setShowApiKeysForm(false)}
        isLoading={isLoading}
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start space-x-4">
          {/* YouTube Icon */}
          <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Play className="w-6 h-6 text-red-600 dark:text-red-400 fill-current" />
          </div>

          <div className="flex-1 space-y-4">
            {/* Connection Status */}
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                YouTube Connection
                {authState.isConnected ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-gray-400" />
                )}
              </h3>
              
              {authState.isConnected && authState.channel ? (
                <div className="mt-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center space-x-3">
                    <img
                      src={authState.channel.thumbnailUrl}
                      alt={authState.channel.title}
                      className="w-8 h-8 rounded-full"
                    />
                    <div>
                      <p className="font-medium text-sm text-green-800 dark:text-green-200">
                        {authState.channel.title}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Connected successfully
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">
                  Connect your YouTube account to browse and upload your videos
                </p>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <Alert className="border-red-200 bg-red-50 dark:bg-red-950/50 dark:border-red-800">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                <AlertDescription className="text-red-800 dark:text-red-200">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              {!authState.isConnected ? (
                <Button
                  onClick={handleConnect}
                  disabled={isLoading}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Connect YouTube
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleDisconnect}
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
                >
                  <User className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              )}

              <Button
                onClick={handleReconfigure}
                variant="outline"
                size="sm"
                className="flex-shrink-0"
              >
                <Settings className="w-4 h-4 mr-2" />
                API Settings
              </Button>
            </div>

            {/* Info */}
            <div className="text-xs text-muted-foreground bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
              <p className="font-medium mb-1">Privacy & Security:</p>
              <ul className="space-y-1 ml-4 list-disc">
                <li>Your API keys are encrypted and stored securely</li>
                <li>Only you can access your YouTube videos</li>
                <li>You can disconnect anytime</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}