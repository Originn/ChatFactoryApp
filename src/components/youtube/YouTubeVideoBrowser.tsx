'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  Grid, 
  List, 
  Play, 
  Clock, 
  Eye, 
  Calendar,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Filter,
  MoreVertical,
  ArrowUpDown
} from 'lucide-react';
import { YouTubeService } from '@/services/youtubeService';
import { YouTubeVideo } from '@/types/youtube';
import { Tooltip } from '@/components/ui/custom-tooltip';

interface YouTubeVideoBrowserProps {
  onVideosSelected: (videoIds: string[]) => void;
  selectedVideoIds: string[];
  isProcessing?: boolean;
}

export default function YouTubeVideoBrowser({ 
  onVideosSelected, 
  selectedVideoIds,
  isProcessing = false 
}: YouTubeVideoBrowserProps) {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [privacyFilter, setPrivacyFilter] = useState<'all' | 'public' | 'unlisted' | 'private'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);
  
  const youtubeService = YouTubeService.getInstance();

  useEffect(() => {
    loadVideos();
  }, []);

  useEffect(() => {
    const filteredAndSorted = getFilteredAndSortedVideos();
    // Update display without new API call for client-side filtering
  }, [searchQuery, privacyFilter, sortBy]);

  const loadVideos = async (loadMore = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await youtubeService.fetchVideos({
        maxResults: 20,
        pageToken: loadMore ? nextPageToken : undefined
      });

      if (loadMore) {
        setVideos(prev => [...prev, ...result.videos]);
      } else {
        setVideos(result.videos);
      }

      setNextPageToken(result.nextPageToken);
      setHasMore(!!result.nextPageToken);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load videos');
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredAndSortedVideos = () => {
    let filtered = videos;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(video =>
        video.title.toLowerCase().includes(query) ||
        video.description.toLowerCase().includes(query)
      );
    }

    // Filter by privacy
    if (privacyFilter !== 'all') {
      filtered = filtered.filter(video => video.privacy === privacyFilter);
    }

    // Sort videos
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
        case 'oldest':
          return new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const toggleVideoSelection = (videoId: string) => {
    if (isProcessing) return;
    
    const newSelection = selectedVideoIds.includes(videoId)
      ? selectedVideoIds.filter(id => id !== videoId)
      : [...selectedVideoIds, videoId];
    
    onVideosSelected(newSelection);
  };

  const selectAll = () => {
    if (isProcessing) return;
    
    const filteredVideos = getFilteredAndSortedVideos();
    const allVisible = filteredVideos.every(video => selectedVideoIds.includes(video.id));
    
    if (allVisible) {
      // Deselect all visible
      const visibleIds = filteredVideos.map(v => v.id);
      onVideosSelected(selectedVideoIds.filter(id => !visibleIds.includes(id)));
    } else {
      // Select all visible
      const visibleIds = filteredVideos.map(v => v.id);
      const combinedIds = selectedVideoIds.concat(visibleIds);
      const newSelection = Array.from(new Set(combinedIds));
      onVideosSelected(newSelection);
    }
  };

  const formatViewCount = (count?: string) => {
    if (!count) return '0 views';
    const num = parseInt(count);
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M views`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K views`;
    return `${num} views`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredVideos = getFilteredAndSortedVideos();
  const allVisibleSelected = filteredVideos.length > 0 && 
    filteredVideos.every(video => selectedVideoIds.includes(video.id));

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50 dark:bg-red-950/50 dark:border-red-800">
        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
        <AlertDescription className="text-red-800 dark:text-red-200">
          {error}
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadVideos()}
            className="ml-2"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search your videos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            disabled={isProcessing}
          />
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Privacy Filter */}
          <select
            value={privacyFilter}
            onChange={(e) => setPrivacyFilter(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isProcessing}
          >
            <option value="all">All Videos</option>
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={isProcessing}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="title">By Title</option>
          </select>

          {/* View Mode */}
          <div className="flex border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 text-sm ${
                viewMode === 'grid'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              disabled={isProcessing}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 text-sm border-l border-gray-300 dark:border-gray-600 ${
                viewMode === 'list'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              disabled={isProcessing}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Selection Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allVisibleSelected && filteredVideos.length > 0}
            onCheckedChange={selectAll}
            disabled={isProcessing || filteredVideos.length === 0}
          />
          <span className="text-sm text-muted-foreground">
            {selectedVideoIds.length > 0 ? (
              <>
                <strong>{selectedVideoIds.length}</strong> video{selectedVideoIds.length !== 1 ? 's' : ''} selected
                {filteredVideos.length !== videos.length && (
                  <> • <strong>{filteredVideos.length}</strong> visible</>
                )}
              </>
            ) : (
              <>
                <strong>{filteredVideos.length}</strong> video{filteredVideos.length !== 1 ? 's' : ''} found
                {filteredVideos.length !== videos.length && (
                  <> of <strong>{videos.length}</strong> total</>
                )}
              </>
            )}
          </span>
        </div>

        {selectedVideoIds.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onVideosSelected([])}
            disabled={isProcessing}
          >
            Clear Selection
          </Button>
        )}
      </div>

      {/* Videos Display */}
      {isLoading && videos.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
            <p className="text-muted-foreground">Loading your YouTube videos...</p>
          </div>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Play className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="font-medium text-lg mb-2">No videos found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery || privacyFilter !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'No videos available in your YouTube channel'
            }
          </p>
          {(searchQuery || privacyFilter !== 'all') && (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setPrivacyFilter('all');
              }}
            >
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Videos Grid/List */}
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'space-y-3'
          }>
            {filteredVideos.map((video) => (
              <Card
                key={video.id}
                className={`group cursor-pointer transition-all duration-200 ${
                  selectedVideoIds.includes(video.id)
                    ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'hover:shadow-md'
                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => toggleVideoSelection(video.id)}
              >
                <CardContent className={viewMode === 'grid' ? 'p-0' : 'p-4'}>
                  <div className={viewMode === 'grid' ? 'space-y-3' : 'flex space-x-3'}>
                    {/* Thumbnail */}
                    <div className={`relative ${viewMode === 'grid' ? '' : 'flex-shrink-0'}`}>
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className={`rounded-t-lg object-cover ${
                          viewMode === 'grid' 
                            ? 'w-full h-36 sm:h-32' 
                            : 'w-24 h-16 rounded-lg'
                        }`}
                      />
                      
                      {/* Duration Badge */}
                      <Badge
                        variant="secondary"
                        className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 hover:bg-black/70"
                      >
                        {video.duration}
                      </Badge>

                      {/* Selection Indicator */}
                      <div className="absolute top-2 left-2">
                        <Checkbox
                          checked={selectedVideoIds.includes(video.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="bg-white/90 border-white"
                        />
                      </div>

                      {/* Privacy Badge */}
                      <Badge
                        variant={video.privacy === 'public' ? 'default' : 'secondary'}
                        className={`absolute top-2 right-2 text-xs ${
                          video.privacy === 'public' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : video.privacy === 'unlisted'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {video.privacy}
                      </Badge>
                    </div>

                    {/* Video Info */}
                    <div className={`${viewMode === 'grid' ? 'p-3' : 'flex-1 min-w-0'}`}>
                      <h3 className="font-medium text-sm line-clamp-2 mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {video.title}
                      </h3>
                      
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {formatViewCount(video.viewCount)}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(video.publishedAt)}
                        </div>
                      </div>

                      {viewMode === 'list' && video.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {video.description}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="text-center pt-6">
              <Button
                variant="outline"
                onClick={() => loadVideos(true)}
                disabled={isLoading || isProcessing}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More Videos'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}