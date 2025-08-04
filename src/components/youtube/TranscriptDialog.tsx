'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, Download, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TranscriptItem {
  text: string;
  start: number;
  duration: number;
}

interface TranscriptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  videoTitle: string;
  language: string;
  userId: string;
}

export default function TranscriptDialog({ 
  isOpen, 
  onClose, 
  videoId, 
  videoTitle,
  language,
  userId 
}: TranscriptDialogProps) {
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchTranscript = async () => {
    if (!videoId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/youtube/transcript?videoId=${videoId}&userId=${userId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transcript');
      }

      setTranscript(data.transcript || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transcript');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && videoId) {
      fetchTranscript();
    }
  }, [isOpen, videoId]);

  const copyTranscript = () => {
    const text = transcript.map(item => item.text).join(' ');
    navigator.clipboard.writeText(text);
  };

  const downloadTranscript = () => {
    const text = transcript.map(item => 
      `[${formatTime(item.start)}] ${item.text}`
    ).join('\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoTitle}-transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white line-clamp-2">
                {videoTitle}
              </h2>
              <div className="flex items-center space-x-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  {language} Transcript
                </Badge>
                {transcript.length > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {transcript.length} segments
                  </span>
                )}
              </div>
            </div>
            <Button
              onClick={onClose}
              variant="outline"
              size="sm"
              className="flex-shrink-0 w-8 h-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 p-4 sm:p-6">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span className="text-gray-600 dark:text-gray-400">Loading transcript...</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <Button onClick={fetchTranscript} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          )}

          {!isLoading && !error && transcript.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <p className="text-gray-600 dark:text-gray-400">No transcript available for this video.</p>
            </div>
          )}

          {!isLoading && !error && transcript.length > 0 && (
            <>
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:space-x-2 sm:gap-0 mb-4">
                <Button onClick={copyTranscript} variant="outline" size="sm" className="w-full sm:w-auto">
                  <Copy className="h-4 w-4 mr-1" />
                  Copy
                </Button>
                <Button onClick={downloadTranscript} variant="outline" size="sm" className="w-full sm:w-auto">
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>

              <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900 overflow-y-auto max-h-96">
                <div className="space-y-3">
                  {transcript.map((item, index) => (
                    <div key={index} className="flex gap-3">
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-mono min-w-[50px] flex-shrink-0 mt-0.5">
                        {formatTime(item.start)}
                      </span>
                      <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}