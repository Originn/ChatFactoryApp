'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from "@/components/ui/progress";
import SimplifiedYouTubeConnect from '@/components/youtube/SimplifiedYouTubeConnect';
import TranscriptDialog from '@/components/youtube/TranscriptDialog';
import YouTubeVideoPlayer from '@/components/youtube/YouTubeVideoPlayer';
import { CentralizedYouTubeService } from '@/services/centralizedYouTubeService';
import { YouTubeVideo } from '@/types/youtube';
import { Play, FileText, Youtube, Search, Subtitles, Languages, Trash2 } from 'lucide-react';
import { Input } from "@/components/ui/input";

interface UploadedFile {
  file: File;
  id: string;
  type: 'regular' | 'chm' | 'pdf' | 'video' | 'image';
  status: 'pending' | 'uploading' | 'converting' | 'converting_chm' | 'transcribing' | 'extracting_text' | 'generating_embeddings' | 'completed' | 'completed_pdf_only' | 'error';
  progress?: number;
  jobId?: string;
  error?: string;
  isPublic: boolean;
  vectorCount?: number;
  embeddingModel?: string;
  embeddingError?: string;
  pipelineStage?: 'chm_conversion' | 'video_transcription' | 'ocr_extraction' | 'embedding_generation' | 'completed';
  pineconeIndex?: string;
  mode?: 'enhanced_complete' | 'pdf_only' | 'legacy';
  // Video specific
  duration?: number;
  language?: string;
  transcription?: string;
  // Image specific
  wordCount?: number;
  charCount?: number;
  ocrProvider?: string;
  ocrModel?: string;
}

interface InlineDocumentUploadProps {
  chatbotId: string;
  onUploadComplete?: () => void;
}

export default function InlineDocumentUpload({ chatbotId, onUploadComplete }: InlineDocumentUploadProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const getPrivacyButtonClasses = (isPublic: boolean) => {
    const base = 'text-xs px-2 py-1 rounded border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-700';
    if (isPublic) {
      return `${base} bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-100 dark:border-emerald-400/40 dark:hover:bg-emerald-500/25`;
    }
    return `${base} bg-gray-100 text-gray-700 border-transparent hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500/60 dark:hover:bg-gray-500`;
  };
  
  // YouTube-related state
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false);
  const [youtubeVideos, setYoutubeVideos] = useState<YouTubeVideo[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessingVideos, setIsProcessingVideos] = useState(false);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<{
    progress: number;
    processedVideos: number;
    totalVideos: number;
    currentVideo?: string;
    status: string;
    errors?: any[];
  } | null>(null);
  const [processedVideoIds, setProcessedVideoIds] = useState<Set<string>>(new Set());
  const [isLoadingProcessedVideos, setIsLoadingProcessedVideos] = useState(false);
  
  // Transcript dialog state
  const [transcriptDialog, setTranscriptDialog] = useState<{
    isOpen: boolean;
    videoId: string;
    videoTitle: string;
    language: string;
  }>({
    isOpen: false,
    videoId: '',
    videoTitle: '',
    language: ''
  });

  // Video player state
  const [videoPlayer, setVideoPlayer] = useState<{
    isOpen: boolean;
    videoId: string;
    videoTitle: string;
  }>({
    isOpen: false,
    videoId: '',
    videoTitle: ''
  });

  // Video deletion state
  const [deletingVideoIds, setDeletingVideoIds] = useState<Set<string>>(new Set());
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    isOpen: boolean;
    videoId: string;
    videoTitle: string;
  }>({
    isOpen: false,
    videoId: '',
    videoTitle: ''
  });

  // Load processed videos on component mount
  const loadProcessedVideos = async () => {
    if (!user?.uid || !chatbotId) return;
    
    setIsLoadingProcessedVideos(true);
    try {
      const response = await fetch(`/api/youtube/processed-videos?chatbotId=${chatbotId}&userId=${user.uid}`);
      const result = await response.json();
      
      if (result.success && result.processedVideos) {
        const videoIds = new Set<string>(result.processedVideos.map((v: any) => v.videoId));
        setProcessedVideoIds(videoIds);
        console.log(`✅ Loaded ${videoIds.size} processed videos from database`);
      }
    } catch (error) {
      console.error('Failed to load processed videos:', error);
    } finally {
      setIsLoadingProcessedVideos(false);
    }
  };

  // Load processed videos when component mounts or chatbotId/user changes
  useEffect(() => {
    loadProcessedVideos();
  }, [chatbotId, user?.uid]);
  
  const youtubeService = CentralizedYouTubeService.getInstance();

  const getProgressForProcessing = (status: string, elapsed: number, type: string) => {
    if (type === 'chm') {
      switch(status) {
        case 'converting_chm': 
          return Math.min(10 + (elapsed * 0.8), 60);
        case 'generating_embeddings':
          return Math.min(60 + (elapsed * 0.4), 95);
        case 'completed':
        case 'completed_pdf_only':
          return 100;
        default:
          return Math.min(elapsed * 2, 10);
      }
    } else if (type === 'video') {
      switch(status) {
        case 'transcribing': 
          return Math.min(10 + (elapsed * 0.6), 70);
        case 'generating_embeddings':
          return Math.min(70 + (elapsed * 0.3), 95);
        case 'completed':
          return 100;
        default:
          return Math.min(elapsed * 2, 10);
      }
    } else if (type === 'image') {
      switch(status) {
        case 'extracting_text': 
          return Math.min(10 + (elapsed * 2), 85);
        case 'generating_embeddings':
          return Math.min(85 + (elapsed * 0.5), 95);
        case 'completed':
          return 100;
        default:
          return Math.min(elapsed * 3, 10);
      }
    } else {
      // PDF and other files
      return Math.min(elapsed * 3, 95);
    }
  };

  const getStatusMessage = (file: UploadedFile) => {
    switch(file.status) {
      case 'pending':
        return 'Ready to upload';
      case 'uploading':
        return 'Uploading file...';
      case 'converting_chm':
        return 'Converting CHM to PDF...';
      case 'transcribing':
        return 'Transcribing video content...';
      case 'extracting_text':
        return 'Extracting text with Gemini OCR...';
      case 'generating_embeddings':
        return `Generating embeddings${file.embeddingModel ? ` with ${file.embeddingModel}` : ''}...`;
      case 'completed':
        if (file.type === 'chm') {
          return '✅ Conversion and ingestion completed successfully';
        } else if (file.type === 'video') {
          return `✅ Video transcribed and embedded! ${file.vectorCount || 0} vectors created${file.duration ? ` (${Math.round(file.duration)}s)` : ''}`;
        } else if (file.type === 'image') {
          return `✅ Image OCR completed! ${file.vectorCount || 2} vectors created - ${file.wordCount || 0} words extracted`;
        }
        return `✅ Completed! ${file.vectorCount || 0} vectors created${file.pineconeIndex ? ` in ${file.pineconeIndex}` : ''}`;
      case 'completed_pdf_only':
        return `✅ PDF created. Embeddings: ${file.embeddingError || 'Not configured'}`;
      case 'error':
        return `❌ Error: ${file.error}`;
      default:
        return 'Processing...';
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = Array.from(files).map(file => {
      let fileType: 'regular' | 'chm' | 'pdf' | 'video' | 'image' = 'regular';
      
      if (file.name.toLowerCase().endsWith('.chm')) {
        fileType = 'chm';
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        fileType = 'pdf';
      } else if (file.type.startsWith('video/') || 
                 ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.wmv'].some(ext => 
                   file.name.toLowerCase().endsWith(ext))) {
        fileType = 'video';
      } else if (file.type.startsWith('image/') && 
                 ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type)) {
        fileType = 'image';
      }

      return {
        file,
        id: `${Date.now()}-${Math.random()}`,
        type: fileType,
        status: 'pending',
        isPublic: false
      };
    });

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Warm containers based on file types
    const fileTypes = new Set(newFiles.map(f => f.type));
    warmContainers(fileTypes);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (!files) return;

    const newFiles: UploadedFile[] = Array.from(files).map(file => {
      let fileType: 'regular' | 'chm' | 'pdf' | 'video' | 'image' = 'regular';
      
      if (file.name.toLowerCase().endsWith('.chm')) {
        fileType = 'chm';
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        fileType = 'pdf';
      } else if (file.type.startsWith('video/') || 
                 ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.wmv'].some(ext => 
                   file.name.toLowerCase().endsWith(ext))) {
        fileType = 'video';
      } else if (file.type.startsWith('image/') && 
                 ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type)) {
        fileType = 'image';
      }

      return {
        file,
        id: `${Date.now()}-${Math.random()}`,
        type: fileType,
        status: 'pending',
        isPublic: false
      };
    });

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Warm containers based on file types
    const fileTypes = new Set(newFiles.map(f => f.type));
    warmContainers(fileTypes);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const startEstimatedProgress = (fileId: string, fileType: string) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      
      setUploadedFiles(prev => prev.map(f => {
        if (f.id === fileId && (f.status === 'converting_chm' || f.status === 'transcribing' || f.status === 'generating_embeddings')) {
          const newProgress = getProgressForProcessing(f.status, elapsed, fileType);
          return { ...f, progress: newProgress };
        }
        return f;
      }));
    }, 1000);

    return interval;
  };

  const processCHMFile = async (fileItem: UploadedFile, isPublic: boolean = false) => {
    try {
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { 
          ...f, 
          status: 'converting_chm', 
          progress: 10,
          pipelineStage: 'chm_conversion',
          isPublic 
        } : f
      ));

      const progressInterval = startEstimatedProgress(fileItem.id, 'chm');

      const formData = new FormData();
      formData.append('file', fileItem.file);
      formData.append('chatbotId', chatbotId);
      formData.append('userId', user?.uid || '');
      formData.append('isPublic', isPublic.toString());

      const response = await fetch('/api/chm-convert', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        clearInterval(progressInterval);
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'completed',
            progress: 100,
            vectorCount: result.vectorCount,
            mode: result.mode,
            pipelineStage: 'completed'
          } : f
        ));
        
        if (onUploadComplete) {
          onUploadComplete();
        }
      } else {
        clearInterval(progressInterval);
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'error',
            error: result.error 
          } : f
        ));
      }
    } catch (error) {
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { 
          ...f, 
          status: 'error',
          error: 'Upload failed' 
        } : f
      ));
    }
  };

  const processPDFFile = async (fileItem: UploadedFile, isPublic: boolean = false) => {
    try {
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { 
          ...f, 
          status: 'uploading',
          progress: 10,
          isPublic 
        } : f
      ));

      const formData = new FormData();
      formData.append('file', fileItem.file);
      formData.append('chatbotId', chatbotId);
      formData.append('userId', user?.uid || '');
      formData.append('isPublic', isPublic.toString());

      const response = await fetch('/api/pdf-convert', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'completed',
            progress: 100,
            vectorCount: result.vectorCount
          } : f
        ));
        
        if (onUploadComplete) {
          onUploadComplete();
        }
      } else {
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'error',
            error: result.error 
          } : f
        ));
      }
    } catch (error) {
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { 
          ...f, 
          status: 'error',
          error: 'Upload failed' 
        } : f
      ));
    }
  };

  const processVideoFile = async (fileItem: UploadedFile, isPublic: boolean = false) => {
    try {
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { 
          ...f, 
          status: 'transcribing', 
          progress: 10,
          pipelineStage: 'video_transcription',
          isPublic 
        } : f
      ));

      const progressInterval = startEstimatedProgress(fileItem.id, 'video');

      const formData = new FormData();
      formData.append('file', fileItem.file);
      formData.append('chatbotId', chatbotId);
      formData.append('userId', user?.uid || '');
      formData.append('isPublic', isPublic.toString());
      formData.append('enableProcessing', 'true'); // Always enable semantic processing for better chunking
      formData.append('useGPU', 'false'); // Always use CPU processing

      const response = await fetch('/api/video-convert', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        clearInterval(progressInterval);
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'completed',
            progress: 100,
            vectorCount: result.vectorCount,
            duration: result.duration,
            language: result.language,
            transcription: result.transcription,
            pipelineStage: 'completed'
          } : f
        ));
        
        if (onUploadComplete) {
          onUploadComplete();
        }
      } else {
        clearInterval(progressInterval);
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'error',
            error: result.error 
          } : f
        ));
      }
    } catch (error) {
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { 
          ...f, 
          status: 'error',
          error: 'Video upload failed' 
        } : f
      ));
    }
  };

  const processImageFile = async (fileItem: UploadedFile, isPublic: boolean = false) => {
    try {
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { 
          ...f, 
          status: 'extracting_text', 
          progress: 10,
          pipelineStage: 'ocr_extraction',
          isPublic 
        } : f
      ));

      const formData = new FormData();
      formData.append('file', fileItem.file);
      formData.append('chatbotId', chatbotId);
      formData.append('userId', user?.uid || '');
      formData.append('isPublic', isPublic.toString());

      const response = await fetch('/api/image-convert', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'completed',
            progress: 100,
            vectorCount: result.vectorCount,
            wordCount: result.wordCount,
            charCount: result.charCount,
            ocrProvider: result.ocrProvider,
            ocrModel: result.ocrModel,
            embeddingModel: result.embeddingModel,
            pipelineStage: 'completed'
          } : f
        ));
        
        console.log(`✅ Image OCR processed: ${result.vectorCount} vectors created`);
        console.log(`🔍 OCR extracted: ${result.wordCount} words`);
        console.log(`🧠 Embedding: ${result.embeddingModel}`);
        
        if (onUploadComplete) {
          onUploadComplete();
        }
      } else {
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'error',
            error: result.error 
          } : f
        ));
      }
    } catch (error) {
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { 
          ...f, 
          status: 'error',
          error: 'Image OCR processing failed' 
        } : f
      ));
    }
  };

  const uploadFiles = async () => {
    if (!user?.uid) return;

    setIsProcessing(true);
    
    // Process all files in parallel for better performance
    const pendingFiles = uploadedFiles.filter(f => f.status === 'pending');
    
    try {
      await Promise.all(
        pendingFiles.map(file => {
          if (file.type === 'chm') {
            return processCHMFile(file, file.isPublic);
          } else if (file.type === 'pdf') {
            return processPDFFile(file, file.isPublic);
          } else if (file.type === 'video') {
            return processVideoFile(file, file.isPublic);
          } else if (file.type === 'image') {
            return processImageFile(file, file.isPublic);
          }
          return Promise.resolve();
        })
      );
    } catch (error) {
      console.error('Error during parallel file processing:', error);
    }

    setIsProcessing(false);
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const toggleFilePrivacy = (fileId: string) => {
    setUploadedFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, isPublic: !f.isPublic } : f
    ));
  };

  const warmContainers = async (fileTypes: Set<string>) => {
    const warmingPromises = [];
    
    if (fileTypes.has('video')) {
      console.log('🔥 Warming video-converter containers (CPU + GPU)...');
      warmingPromises.push(
        fetch('/api/video-convert', { method: 'GET' })
          .then(response => response.json())
          .then(data => {
            console.log('✅ Video converters warmed:', {
              cpu: data.cpu,
              gpu: data.gpu,
              service: data.service
            });
          })
          .catch(error => console.log('⚠️ Video converter warming failed:', error))
      );
    }
    
    if (fileTypes.has('chm')) {
      console.log('🔥 Warming chm-converter container...');
      warmingPromises.push(
        fetch('/api/chm-convert', { method: 'GET' })
          .then(() => console.log('✅ CHM converter warmed'))
          .catch(() => console.log('⚠️ CHM converter warming failed'))
      );
    }
    
    if (fileTypes.has('pdf')) {
      console.log('🔥 Warming pdf-converter container...');
      warmingPromises.push(
        fetch('/api/pdf-convert', { method: 'GET' })
          .then(() => console.log('✅ PDF converter warmed'))
          .catch(() => console.log('⚠️ PDF converter warming failed'))
      );
    }
    
    if (fileTypes.has('image')) {
      console.log('🔥 Warming image-ocr-converter container...');
      warmingPromises.push(
        fetch('/api/image-convert', { method: 'GET' })
          .then(() => console.log('✅ Image OCR converter warmed'))
          .catch(() => console.log('⚠️ Image OCR converter warming failed'))
      );
    }
    
    // Fire and forget - don't block UI
    Promise.allSettled(warmingPromises);
  };

  // YouTube functionality
  const handleYouTubeConnection = (connected: boolean) => {
    setIsYouTubeConnected(connected);
    if (connected) {
      loadYouTubeVideos();
    } else {
      setYoutubeVideos([]);
      setSelectedVideos(new Set());
    }
  };

  const loadYouTubeVideos = async () => {
    if (!user?.uid) return;

    setIsLoadingVideos(true);
    try {
      youtubeService.setUserId(user.uid);
      const response = await youtubeService.fetchVideos({ maxResults: 25, searchQuery });
      setYoutubeVideos(response.videos);
    } catch (error) {
      console.error('Error loading YouTube videos:', error);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  const handleVideoSelection = (videoId: string) => {
    setSelectedVideos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(videoId)) {
        newSet.delete(videoId);
      } else {
        newSet.add(videoId);
      }
      return newSet;
    });
  };

  const processSelectedVideos = async () => {
    if (!user?.uid || selectedVideos.size === 0) return;

    setIsProcessingVideos(true);
    setProcessingStatus({
      progress: 0,
      processedVideos: 0,
      totalVideos: selectedVideos.size,
      status: 'starting'
    });
    
    try {
      // Call the API to start processing
      const response = await fetch('/api/youtube/process-videos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoIds: Array.from(selectedVideos),
          isPublic: false,
          chatbotId,
          userId: user.uid
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setProcessingJobId(result.jobId);
        // Start polling for status updates
        pollProcessingStatus(result.jobId);
      } else {
        throw new Error(result.error || 'Failed to start processing');
      }
    } catch (error) {
      console.error('Error processing YouTube videos:', error);
      setIsProcessingVideos(false);
      setProcessingStatus(null);
    }
  };

  const pollProcessingStatus = async (jobId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/youtube/process-videos?jobId=${jobId}`);
        const jobStatus = await response.json();
        
        setProcessingStatus({
          progress: jobStatus.progress || 0,
          processedVideos: jobStatus.processedVideos || 0,
          totalVideos: jobStatus.totalVideos || selectedVideos.size,
          currentVideo: jobStatus.currentVideo,
          status: jobStatus.status || 'processing',
          errors: jobStatus.errors || []
        });
        
        if (jobStatus.status === 'completed' || jobStatus.status === 'error') {
          clearInterval(pollInterval);
          setIsProcessingVideos(false);
          
          // Mark processed videos
          if (jobStatus.status === 'completed') {
            const processedIds = Array.from(selectedVideos).filter(
              videoId => !jobStatus.errors?.some((err: any) => err.videoId === videoId)
            );
            setProcessedVideoIds(prev => {
              const newSet = new Set(prev);
              processedIds.forEach(id => newSet.add(id));
              return newSet;
            });
          }
          
          // Clear selection and refresh
          setSelectedVideos(new Set());
          setProcessingJobId(null);
          
          // Auto-clear processing status based on job outcome
          if (jobStatus.status === 'completed') {
            if (jobStatus.errors && jobStatus.errors.length > 0) {
              // Keep error status visible longer (10 seconds) so user can read errors
              setTimeout(() => {
                setProcessingStatus(null);
              }, 10000);
            } else {
              // Clear successful completion after 3 seconds
              setTimeout(() => {
                setProcessingStatus(null);
              }, 3000);
            }
          } else if (jobStatus.status === 'error') {
            // Keep full error status visible for 15 seconds
            setTimeout(() => {
              setProcessingStatus(null);
            }, 15000);
          }
          
          if (onUploadComplete) {
            onUploadComplete();
          }
        }
      } catch (error) {
        console.error('Error polling processing status:', error);
        clearInterval(pollInterval);
        setIsProcessingVideos(false);
        setProcessingStatus(null);
      }
    }, 2000); // Poll every 2 seconds
  };

  const filteredVideos = youtubeVideos.filter(video =>
    video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    video.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewTranscript = (video: YouTubeVideo) => {
    if (video.transcripts && video.transcripts.length > 0) {
      setTranscriptDialog({
        isOpen: true,
        videoId: video.id,
        videoTitle: video.title,
        language: video.transcripts[0].languageName
      });
    }
  };

  const closeTranscriptDialog = () => {
    setTranscriptDialog({
      isOpen: false,
      videoId: '',
      videoTitle: '',
      language: ''
    });
  };

  const handlePlayVideo = (video: YouTubeVideo) => {
    setVideoPlayer({
      isOpen: true,
      videoId: video.id,
      videoTitle: video.title
    });
  };

  const closeVideoPlayer = () => {
    setVideoPlayer({
      isOpen: false,
      videoId: '',
      videoTitle: ''
    });
  };

  const handleDeleteVideo = (video: YouTubeVideo) => {
    setDeleteConfirmDialog({
      isOpen: true,
      videoId: video.id,
      videoTitle: video.title
    });
  };

  const closeDeleteConfirmDialog = () => {
    setDeleteConfirmDialog({
      isOpen: false,
      videoId: '',
      videoTitle: ''
    });
  };

  const confirmDeleteVideo = async () => {
    const { videoId, videoTitle } = deleteConfirmDialog;
    
    if (!videoId || !user?.uid) return;
    
    // Close dialog first
    closeDeleteConfirmDialog();
    
    // Add to deleting set
    setDeletingVideoIds(prev => new Set(prev).add(videoId));
    
    try {
      const response = await fetch('/api/youtube/delete-video', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
          chatbotId,
          userId: user.uid
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        // Remove from processed videos set
        setProcessedVideoIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(videoId);
          return newSet;
        });
        
        console.log(`✅ Successfully deleted video: ${videoTitle}`);
        console.log(`🗑️ Deleted ${result.deletedCount} vectors from Pinecone`);
        
        // Show success message (you could add a toast notification here)
        
      } else {
        console.error(`❌ Failed to delete video: ${result.error}`);
        // Show error message (you could add a toast notification here)
      }
    } catch (error) {
      console.error('Error deleting video:', error);
      // Show error message (you could add a toast notification here)
    } finally {
      // Remove from deleting set
      setDeletingVideoIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(videoId);
        return newSet;
      });
    }
  };

  return (
    <Card className="mb-8 dark:bg-gray-800 dark:border-gray-700">
      <CardContent className="p-8">
        <Tabs defaultValue="files" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Document Files</span>
              <span className="sm:hidden">Files</span>
            </TabsTrigger>
            <TabsTrigger value="youtube" className="flex items-center gap-2">
              <Youtube className="w-4 h-4" />
              <span className="hidden sm:inline">YouTube Videos</span>
              <span className="sm:hidden">YouTube</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="space-y-6">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 text-blue-500 dark:text-blue-400 mb-4">
                <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Upload Documents, Videos & Images</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Upload your documentation files, videos, and images to train your chatbot. We support PDF, Markdown, HTML, Word Documents, Text files, <strong className="text-blue-600 dark:text-blue-400">CHM files</strong>, <strong className="text-purple-600 dark:text-purple-400">Video files</strong>, and <strong className="text-green-600 dark:text-green-400">Images with OCR</strong>.
              </p>
          
          <div className="border-2 border-dashed border-blue-300 dark:border-blue-600 rounded-lg p-6 sm:p-12 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-600 hover:from-blue-100 hover:to-purple-100 dark:hover:from-gray-600 dark:hover:to-gray-500 transition-all duration-200">
            <div className="space-y-4">
              <div className="mx-auto h-12 w-12 text-blue-500 dark:text-blue-400">
                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6" 
                  />
                </svg>
              </div>
              
              {/* Upload Area */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div>
                  <Button 
                    type="button"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    Upload Documents
                  </Button>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                  <span className="font-medium text-blue-600 dark:text-blue-400">Click to upload</span> or drag and drop
                </p>
              </div>
              
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Supports: PDF, MD, HTML, DOCX, TXT, CHM files + Video files (MP4, AVI, MOV, MKV, WebM, WMV) + Images (JPG, PNG, WebP, HEIC) up to 50MB each
              </p>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.chm,.md,.html,.docx,.txt,.mp4,.avi,.mov,.mkv,.webm,.wmv,video/*,.jpg,.jpeg,.png,.webp,.heic,.heif,image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* File List */}
        {uploadedFiles.length > 0 && (
          <div className="mt-8 space-y-3">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Selected Files:</h4>
            {uploadedFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                    {file.file.name}
                  </div>
                  <Badge variant={
                    file.type === 'chm' ? 'default' : 
                    file.type === 'video' ? 'secondary' : 
                    file.type === 'image' ? 'default' :
                    'secondary'
                  }>
                    {file.type === 'image' ? 'IMG' : file.type.toUpperCase()}
                  </Badge>
                  <button
                    onClick={() => toggleFilePrivacy(file.id)}
                    className={getPrivacyButtonClasses(file.isPublic)}
                    disabled={file.status !== 'pending'}
                  >
                    {file.isPublic ? '🌐 Public' : '🔒 Private'}
                  </button>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-gray-600 min-w-0">
                    {getStatusMessage(file)}
                  </div>
                  
                  {file.progress !== undefined && file.status !== 'completed' && file.status !== 'error' && (
                    <div className="w-24">
                      <Progress value={file.progress} className="h-2" />
                    </div>
                  )}
                  
                  {file.status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Remove
                    </Button>
                  )}
                  
                  {(file.status === 'completed' || file.status === 'error') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                      className="text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Clear All Button */}
        {uploadedFiles.some(f => f.status === 'completed' || f.status === 'error') && (
          <div className="flex justify-center mt-4">
            <Button
              variant="outline"
              onClick={() => setUploadedFiles(prev => prev.filter(f => f.status === 'pending'))}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Clear All Completed
            </Button>
          </div>
        )}

        {/* Upload Button */}
        {uploadedFiles.some(f => f.status === 'pending') && (
          <div className="flex justify-center mt-6">
            <Button
              onClick={uploadFiles}
              disabled={isProcessing}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
            >
              {isProcessing ? 'Processing...' : `Upload ${uploadedFiles.filter(f => f.status === 'pending').length} file(s)`}
            </Button>
          </div>
        )}
          </TabsContent>

          <TabsContent value="youtube" className="space-y-6">
            <div className="space-y-6">
              {/* YouTube Connection */}
              <div className="flex justify-center">
                <SimplifiedYouTubeConnect 
                  userId={user?.uid || ''}
                  onConnectionChange={handleYouTubeConnection}
                />
              </div>

              {/* YouTube Videos Section */}
              {isYouTubeConnected && (
                <div className="space-y-4">
                  {/* Search Bar */}
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search your YouTube videos..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                      />
                    </div>
                    <Button
                      onClick={loadYouTubeVideos}
                      disabled={isLoadingVideos}
                      variant="outline"
                      size="sm"
                    >
                      {isLoadingVideos ? 'Loading...' : 'Refresh'}
                    </Button>
                  </div>

                  {/* Loading State */}
                  {isLoadingVideos && (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
                      <p className="text-gray-600 dark:text-gray-400">Loading your YouTube videos...</p>
                    </div>
                  )}

                  {/* Videos Grid */}
                  {!isLoadingVideos && filteredVideos.length > 0 && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredVideos.map((video) => {
                          const isProcessed = processedVideoIds.has(video.id);
                          const isCurrentlyProcessing = processingStatus?.currentVideo === video.id;
                          
                          return (
                          <div
                            key={video.id}
                            className={`border-2 rounded-lg p-4 transition-all duration-200 relative ${
                              isProcessed
                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-400'
                                : isCurrentlyProcessing
                                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-400'
                                : selectedVideos.has(video.id)
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                            }`}
                          >
                            {/* Processing indicator overlay */}
                            {isCurrentlyProcessing && (
                              <div className="absolute top-2 right-2 flex items-center space-x-1">
                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-orange-500"></div>
                                <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">Processing...</span>
                              </div>
                            )}
                            
                            {/* Delete button for processed videos */}
                            {isProcessed && (
                              <div className="absolute top-2 right-2">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!deletingVideoIds.has(video.id)) {
                                      handleDeleteVideo(video);
                                    }
                                  }}
                                  disabled={deletingVideoIds.has(video.id)}
                                  className={`p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors ${
                                    deletingVideoIds.has(video.id) ? 'opacity-50 cursor-not-allowed' : 'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300'
                                  }`}
                                  title={deletingVideoIds.has(video.id) ? 'Deleting...' : 'Delete video from knowledge base'}
                                >
                                  {deletingVideoIds.has(video.id) ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-t border-b border-red-500"></div>
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            )}
                            
                            <div className="flex items-start space-x-3">
                              <input
                                type="checkbox"
                                checked={selectedVideos.has(video.id)}
                                onChange={() => handleVideoSelection(video.id)}
                                disabled={isProcessed || isCurrentlyProcessing || isProcessingVideos}
                                className={`mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer ${
                                  isProcessed || isCurrentlyProcessing || isProcessingVideos ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                              />
                              <div 
                                className={`flex-1 min-w-0 ${
                                  isProcessed || isCurrentlyProcessing || isProcessingVideos 
                                    ? 'cursor-default' 
                                    : 'cursor-pointer'
                                }`}
                                onClick={() => {
                                  if (!isProcessed && !isCurrentlyProcessing && !isProcessingVideos) {
                                    handleVideoSelection(video.id);
                                  }
                                }}
                              >
                                <div className="flex items-center space-x-2 mb-2 flex-wrap gap-1">
                                  <Play className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                                  <Badge variant={video.privacy === 'public' ? 'secondary' : 'outline'} className="text-xs">
                                    {video.privacy}
                                  </Badge>
                                  {video.transcripts && video.transcripts.length > 0 && (
                                    <Badge 
                                      variant="outline" 
                                      className="text-xs bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleViewTranscript(video);
                                      }}
                                    >
                                      <Subtitles className="h-3 w-3 mr-1" />
                                      Transcript
                                    </Badge>
                                  )}
                                  {isProcessed && (
                                    <Badge 
                                      variant="outline" 
                                      className="text-xs bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
                                    >
                                      <div className="h-2 w-2 bg-green-500 rounded-full mr-1"></div>
                                      Processed
                                    </Badge>
                                  )}
                                </div>
                                <h4 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-1">
                                  {video.title}
                                </h4>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {video.duration} • {video.viewCount ? `${parseInt(video.viewCount).toLocaleString()} views` : 'No views'}
                                  </p>
                                  {video.language && video.language !== 'none' && (
                                    <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                                      {video.language.toUpperCase()}
                                    </Badge>
                                  )}
                                </div>
                                
                                {/* Transcript Languages */}
                                {video.transcripts && video.transcripts.length > 0 && (
                                  <div className="flex items-center space-x-1 mb-2">
                                    <Languages className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                      {video.transcripts
                                        .filter(t => t.languageName && t.languageName.trim()) // Filter out empty language names
                                        .map(t => t.languageName)
                                        .join(', ') || 'Transcript available'} {/* Fallback text */}
                                      {video.transcripts.some(t => t.isAutoGenerated) && (
                                        <span className="text-gray-500 dark:text-gray-400 ml-1">(Auto)</span>
                                      )}
                                    </span>
                                  </div>
                                )}
                                
                                {video.description && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                    {video.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            {video.thumbnailUrl && (
                              <div className="relative mt-3 group cursor-pointer" onClick={() => handlePlayVideo(video)}>
                                <img
                                  src={video.thumbnailUrl}
                                  alt={video.title}
                                  className="w-full h-20 object-cover rounded transition-transform group-hover:scale-[1.02]"
                                />
                                {/* Play button overlay */}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded">
                                  <div className="bg-red-600 hover:bg-red-700 text-white rounded-full p-2 transform group-hover:scale-110 transition-transform">
                                    <Play className="h-4 w-4 fill-current" />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>

                      {/* Processing Status */}
                      {processingStatus && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                              Processing YouTube Videos
                            </span>
                            <span className="text-sm text-blue-700 dark:text-blue-300">
                              {processingStatus.processedVideos} / {processingStatus.totalVideos}
                            </span>
                          </div>
                          <Progress value={processingStatus.progress} className="h-2 mb-2" />
                          {processingStatus.currentVideo && (
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              Currently processing: {youtubeVideos.find(v => v.id === processingStatus.currentVideo)?.title || processingStatus.currentVideo}
                            </p>
                          )}
                          {processingStatus.errors && processingStatus.errors.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <p className="text-xs font-medium text-red-600 dark:text-red-400">
                                {processingStatus.errors.length} error(s) occurred:
                              </p>
                              <div className="max-h-24 overflow-y-auto space-y-1">
                                {processingStatus.errors.map((error: any, index: number) => {
                                  const videoTitle = youtubeVideos.find(v => v.id === error.videoId)?.title || error.videoId;
                                  const errorType = error.type || 'unknown_error';
                                  const userFriendlyMessage = 
                                    errorType === 'jina_api_error' ? 'Embedding service temporarily unavailable' :
                                    errorType === 'deepgram_api_error' ? 'Transcription service error' :
                                    errorType === 'timeout_error' ? 'Processing timeout - video may be too long' :
                                    errorType === 'network_error' ? 'Network connectivity issue' :
                                    'Processing failed';
                                  
                                  return (
                                    <div key={index} className="text-xs bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800">
                                      <p className="font-medium text-red-700 dark:text-red-300 truncate">
                                        {videoTitle}
                                      </p>
                                      <p className="text-red-600 dark:text-red-400 mt-1">
                                        {userFriendlyMessage}
                                      </p>
                                      {error.timestamp && (
                                        <p className="text-red-500 dark:text-red-500 text-xs mt-1">
                                          {new Date(error.timestamp).toLocaleTimeString()}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              <p className="text-xs text-red-500 dark:text-red-500 italic mt-1">
                                💡 Tip: Try processing failed videos again later if API services were temporarily unavailable
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Process Selected Videos Button */}
                      {selectedVideos.size > 0 && (
                        <div className="flex justify-center pt-4">
                          <Button
                            onClick={processSelectedVideos}
                            disabled={isProcessingVideos}
                            className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium px-8 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200"
                          >
                            {isProcessingVideos 
                              ? 'Processing Videos...' 
                              : `Process ${selectedVideos.size} Selected Video${selectedVideos.size === 1 ? '' : 's'}`
                            }
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* No Videos Found */}
                  {!isLoadingVideos && filteredVideos.length === 0 && youtubeVideos.length > 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-600 dark:text-gray-400">No videos found matching your search.</p>
                    </div>
                  )}

                  {/* No Videos Available */}
                  {!isLoadingVideos && youtubeVideos.length === 0 && (
                    <div className="text-center py-8">
                      <Youtube className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-400">No YouTube videos found in your channel.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      {/* Transcript Dialog */}
      <TranscriptDialog
        isOpen={transcriptDialog.isOpen}
        onClose={closeTranscriptDialog}
        videoId={transcriptDialog.videoId}
        videoTitle={transcriptDialog.videoTitle}
        language={transcriptDialog.language}
        userId={user?.uid || ''}
      />

      {/* YouTube Video Player */}
      <YouTubeVideoPlayer
        isOpen={videoPlayer.isOpen}
        onClose={closeVideoPlayer}
        videoId={videoPlayer.videoId}
        videoTitle={videoPlayer.videoTitle}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmDialog.isOpen} onOpenChange={closeDeleteConfirmDialog}>
        <DialogContent className="p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Video</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Are you sure you want to delete "{deleteConfirmDialog.videoTitle}"? This will remove all embeddings from your knowledge base and cannot be undone.
              </p>
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={closeDeleteConfirmDialog}>
                Cancel
              </Button>
              <Button onClick={confirmDeleteVideo} className="bg-red-600 hover:bg-red-700 text-white">
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
