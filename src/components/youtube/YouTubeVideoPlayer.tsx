'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ExternalLink } from 'lucide-react';

interface YouTubeVideoPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  videoTitle: string;
}

export default function YouTubeVideoPlayer({
  isOpen,
  onClose,
  videoId,
  videoTitle
}: YouTubeVideoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);

  // Reset loading state when video changes
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
    }
  }, [videoId, isOpen]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const openInYouTube = () => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full p-0 bg-black">
        <div className="relative">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between">
            <h3 className="text-white font-medium text-sm line-clamp-1 pr-4">
              {videoTitle}
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={openInYouTube}
                className="text-white hover:bg-white/20"
                title="Open in YouTube"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white hover:bg-white/20"
                title="Close player"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-sm">Loading video...</p>
              </div>
            </div>
          )}

          {/* YouTube Player */}
          <div className="relative aspect-video">
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={videoTitle}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
              onLoad={handleIframeLoad}
            />
          </div>

          {/* Video Info Footer */}
          <div className="bg-gray-900 text-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-gray-300 mb-1">Now Playing</p>
                <h4 className="text-white font-medium line-clamp-2">{videoTitle}</h4>
              </div>
              <Button
                onClick={openInYouTube}
                variant="outline"
                size="sm"
                className="ml-4 border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                YouTube
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}