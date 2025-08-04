'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, ExternalLink, Key, Shield, Info } from 'lucide-react';
import { YouTubeApiKeys } from '@/types/youtube';

interface YouTubeApiKeysFormProps {
  onKeysSubmit: (keys: YouTubeApiKeys) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  initialKeys?: YouTubeApiKeys;
}

export default function YouTubeApiKeysForm({
  onKeysSubmit,
  onCancel,
  isLoading = false,
  initialKeys
}: YouTubeApiKeysFormProps) {
  const [keys, setKeys] = useState<YouTubeApiKeys>(
    initialKeys || {
      clientId: '',
      clientSecret: '',
      apiKey: ''
    }
  );
  
  const [showSecrets, setShowSecrets] = useState({
    clientSecret: false,
    apiKey: false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateKeys = () => {
    const newErrors: Record<string, string> = {};

    if (!keys.clientId.trim()) {
      newErrors.clientId = 'Client ID is required';
    } else if (!keys.clientId.includes('.googleusercontent.com')) {
      newErrors.clientId = 'Client ID should end with .googleusercontent.com';
    }

    if (!keys.clientSecret.trim()) {
      newErrors.clientSecret = 'Client Secret is required';
    } else if (keys.clientSecret.length < 20) {
      newErrors.clientSecret = 'Client Secret seems too short';
    }

    if (!keys.apiKey.trim()) {
      newErrors.apiKey = 'API Key is required';
    } else if (keys.apiKey.length < 30) {
      newErrors.apiKey = 'API Key seems too short';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateKeys()) {
      onKeysSubmit(keys);
    }
  };

  const toggleShowSecret = (field: 'clientSecret' | 'apiKey') => {
    setShowSecrets(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <Key className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <CardTitle className="text-xl font-semibold">Configure YouTube API Keys</CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Enter your personal Google API credentials to access your YouTube videos
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Info Alert */}
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/50 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <strong>Why do I need this?</strong> Each user needs their own Google API keys to access their YouTube videos. 
            Your keys are encrypted and stored securely in your account.
          </AlertDescription>
        </Alert>

        {/* Setup Instructions */}
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-3">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-green-600" />
            How to get your API keys:
          </h3>
          <ol className="text-sm text-muted-foreground space-y-2 ml-6 list-decimal">
            <li>
              Go to the{' '}
              <a 
                href="https://console.developers.google.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1"
              >
                Google Cloud Console
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>Create a new project or select an existing one</li>
            <li>Enable the YouTube Data API v3</li>
            <li>Create credentials (OAuth 2.0 Client ID and API Key)</li>
            <li>Add <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded text-xs">
              {typeof window !== 'undefined' ? window.location.origin : 'your-domain.com'}/api/youtube/callback
            </code> to authorized redirect URIs</li>
          </ol>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client ID */}
          <div className="space-y-2">
            <Label htmlFor="clientId" className="text-sm font-medium">
              OAuth 2.0 Client ID
            </Label>
            <Input
              id="clientId"
              type="text"
              placeholder="123456789-abc123def456.apps.googleusercontent.com"
              value={keys.clientId}
              onChange={(e) => setKeys(prev => ({ ...prev, clientId: e.target.value }))}
              className={errors.clientId ? 'border-red-500 focus:border-red-500' : ''}
              disabled={isLoading}
            />
            {errors.clientId && (
              <p className="text-sm text-red-600 dark:text-red-400">{errors.clientId}</p>
            )}
          </div>

          {/* Client Secret */}
          <div className="space-y-2">
            <Label htmlFor="clientSecret" className="text-sm font-medium">
              OAuth 2.0 Client Secret
            </Label>
            <div className="relative">
              <Input
                id="clientSecret"
                type={showSecrets.clientSecret ? 'text' : 'password'}
                placeholder="GOCSPX-your-client-secret-here"
                value={keys.clientSecret}
                onChange={(e) => setKeys(prev => ({ ...prev, clientSecret: e.target.value }))}
                className={`pr-10 ${errors.clientSecret ? 'border-red-500 focus:border-red-500' : ''}`}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => toggleShowSecret('clientSecret')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showSecrets.clientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.clientSecret && (
              <p className="text-sm text-red-600 dark:text-red-400">{errors.clientSecret}</p>
            )}
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="text-sm font-medium">
              YouTube Data API Key
            </Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showSecrets.apiKey ? 'text' : 'password'}
                placeholder="AIzaSyC1234567890abcdefghijklmnopqrstuvwxyz"
                value={keys.apiKey}
                onChange={(e) => setKeys(prev => ({ ...prev, apiKey: e.target.value }))}
                className={`pr-10 ${errors.apiKey ? 'border-red-500 focus:border-red-500' : ''}`}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => toggleShowSecret('apiKey')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showSecrets.apiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.apiKey && (
              <p className="text-sm text-red-600 dark:text-red-400">{errors.apiKey}</p>
            )}
          </div>

          {/* Security Notice */}
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/50 dark:border-amber-800">
            <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              <strong>Security:</strong> Your API keys are encrypted before storage and only used to access your own YouTube content.
              You can revoke access anytime from your Google Cloud Console.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving Keys...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4 mr-2" />
                  Save & Connect YouTube
                </>
              )}
            </Button>
            
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 sm:flex-initial"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}