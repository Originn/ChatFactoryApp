'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Play, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Download,
  Clock,
  Zap
} from 'lucide-react';
import { YouTubeService } from '@/services/youtubeService';
import { ProcessingVideo } from '@/types/youtube';
import { useAuth } from '@/contexts/AuthContext';
import YouTubeConnect from './YouTubeConnect';
import YouTubeVideoBrowser from './YouTubeVideoBrowser';
import { Tooltip } from '@/components/ui/custom-tooltip';

interface YouTubeUploadSectionProps {
  chatbotId: string;
}

export default function YouTubeUploadSection({ chatbotId }: YouTubeUploadSectionProps) {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingVideos, setProcessingVideos] = useState<ProcessingVideo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const youtubeService = YouTubeService.getInstance();

  useEffect(() => {
    // Clear messages after 5 seconds
    if (error || successMessage) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, successMessage]);

  const handleConnectionChange = (connected: boolean) => {
    setIsConnected(connected);
    if (!connected) {
      setSelectedVideoIds([]);
      setProcessingVideos([]);
    }
  };

  const handleProcessVideos = async () => {
    if (!selectedVideoIds.length || !user?.uid) return;

    try {
      setIsProcessing(true);
      setError(null);
      setSuccessMessage(null);

      // Initialize processing state for each video
      const initialProcessingVideos: ProcessingVideo[] = selectedVideoIds.map(videoId => ({
        videoId,
        status: 'pending',
        progress: 0,
        isPublic
      }));

      setProcessingVideos(initialProcessingVideos);

      // Start processing
      await youtubeService.processVideos(selectedVideoIds, isPublic, chatbotId);

      // Simulate processing progress (in real implementation, you'd poll the API)
      simulateProcessingProgress(selectedVideoIds);

      setSuccessMessage(`Started processing ${selectedVideoIds.length} video${selectedVideoIds.length !== 1 ? 's' : ''}!`);
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to process videos');
      setProcessingVideos([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const simulateProcessingProgress = (videoIds: string[]) => {
    const updateInterval = setInterval(() => {
      setProcessingVideos(prev => {
        const updated = prev.map(video => {
          if (video.status === 'completed' || video.status === 'error') {
            return video;
          }

          let newProgress = video.progress + Math.random() * 15 + 5;
          let newStatus = video.status;

          if (newProgress >= 100) {
            newProgress = 100;
            newStatus = 'completed';
          } else if (newProgress > 20 && video.status === 'pending') {
            newStatus = 'processing';
          }

          return {
            ...video,
            progress: Math.min(newProgress, 100),
            status: newStatus as any
          };
        });

        // Check if all videos are completed
        const allCompleted = updated.every(v => v.status === 'completed' || v.status === 'error');
        if (allCompleted) {
          clearInterval(updateInterval);
          setSelectedVideoIds([]);
          setSuccessMessage('All videos processed successfully!');
        }

        return updated;
      });
    }, 2000);
  };

  const getProcessingStatusIcon = (status: ProcessingVideo['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getProcessingStatusText = (status: ProcessingVideo['status'], progress: number) => {
    switch (status) {
      case 'pending':
        return 'Queued for processing';
      case 'processing':
        return `Processing... ${Math.round(progress)}%`;
      case 'completed':
        return 'Processing completed';
      case 'error':
        return 'Processing failed';
      default:
        return 'Unknown status';
    }
  };

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Play className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="font-semibold text-lg mb-2">YouTube Integration</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Connect your YouTube account to browse your videos and add them to your chatbot's knowledge base.
          </p>
        </div>
        
        <YouTubeConnect onConnectionChange={handleConnectionChange} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <YouTubeConnect onConnectionChange={handleConnectionChange} />

      {/* Success/Error Messages */}
      {error && (
        <Alert className="border-red-200 bg-red-50 dark:bg-red-950/50 dark:border-red-800">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/50 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Processing Status */}
      {processingVideos.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-medium text-lg mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" />
              Processing Videos
            </h3>
            
            <div className="space-y-4">
              {processingVideos.map((video) => (
                <div key={video.videoId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getProcessingStatusIcon(video.status)}
                      <span className="text-sm font-medium">Video {video.videoId}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        video.isPublic 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                      }`}>
                        {video.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {getProcessingStatusText(video.status, video.progress)}
                    </span>
                  </div>
                  
                  <Progress 
                    value={video.progress} 
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video Browser */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="font-medium text-lg">Your YouTube Videos</h3>
              <p className="text-sm text-muted-foreground">
                Select videos to add to your chatbot's knowledge base
              </p>
            </div>

            {selectedVideoIds.length > 0 && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                {/* Public/Private Toggle */}
                <div className="flex items-center space-x-2">
                  <Tooltip
                    content={isPublic 
                      ? "Public: Chatbot users can see video sources and metadata"
                      : "Private: Videos are processed but not visible to chatbot users"
                    }
                    side="top"
                  >
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={isPublic}
                        onCheckedChange={(checked) => setIsPublic(!!checked)}
                        disabled={isProcessing}
                      />
                      <span className="text-sm font-medium">
                        {isPublic ? '🔓 Public Access' : '🔒 Private Access'}
                      </span>
                    </label>
                  </Tooltip>
                </div>

                {/* Process Button */}
                <Button
                  onClick={handleProcessVideos}
                  disabled={isProcessing || selectedVideoIds.length === 0}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Process {selectedVideoIds.length} Video{selectedVideoIds.length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          <YouTubeVideoBrowser
            onVideosSelected={setSelectedVideoIds}
            selectedVideoIds={selectedVideoIds}
            isProcessing={isProcessing}
          />
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-3">
            How YouTube Video Processing Works
          </h3>
          <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <div className="flex items-start gap-2">
              <Download className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Audio is extracted from your selected YouTube videos</span>
            </div>
            <div className="flex items-start gap-2">
              <Zap className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>AI transcription creates searchable text content</span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Content is added to your chatbot's knowledge base</span>
            </div>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
            <strong>Privacy:</strong> Only you can access your videos. Processing happens securely with your own API keys.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}