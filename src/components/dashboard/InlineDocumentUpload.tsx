'use client';

import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from "@/components/ui/progress";

interface UploadedFile {
  file: File;
  id: string;
  type: 'regular' | 'chm' | 'pdf' | 'video';
  status: 'pending' | 'uploading' | 'converting' | 'converting_chm' | 'transcribing' | 'generating_embeddings' | 'completed' | 'completed_pdf_only' | 'error';
  progress?: number;
  jobId?: string;
  error?: string;
  isPublic: boolean;
  vectorCount?: number;
  embeddingModel?: string;
  embeddingError?: string;
  pipelineStage?: 'chm_conversion' | 'video_transcription' | 'embedding_generation' | 'completed';
  pineconeIndex?: string;
  mode?: 'enhanced_complete' | 'pdf_only' | 'legacy';
  // Video specific
  duration?: number;
  language?: string;
  transcription?: string;
  useGPU?: boolean;
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
  const [useGPU, setUseGPU] = useState(false); // GPU processing toggle

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
      case 'generating_embeddings':
        return `Generating embeddings${file.embeddingModel ? ` with ${file.embeddingModel}` : ''}...`;
      case 'completed':
        if (file.type === 'chm') {
          return '✅ Conversion and ingestion completed successfully';
        } else if (file.type === 'video') {
          return `✅ Video transcribed and embedded! ${file.vectorCount || 0} vectors created${file.duration ? ` (${Math.round(file.duration)}s)` : ''}`;
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
      let fileType: 'regular' | 'chm' | 'pdf' | 'video' = 'regular';
      
      if (file.name.toLowerCase().endsWith('.chm')) {
        fileType = 'chm';
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        fileType = 'pdf';
      } else if (file.type.startsWith('video/') || 
                 ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.wmv'].some(ext => 
                   file.name.toLowerCase().endsWith(ext))) {
        fileType = 'video';
      }

      return {
        file,
        id: `${Date.now()}-${Math.random()}`,
        type: fileType,
        status: 'pending',
        isPublic: false,
        ...(fileType === 'video' && { useGPU })
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
      let fileType: 'regular' | 'chm' | 'pdf' | 'video' = 'regular';
      
      if (file.name.toLowerCase().endsWith('.chm')) {
        fileType = 'chm';
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        fileType = 'pdf';
      } else if (file.type.startsWith('video/') || 
                 ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.wmv'].some(ext => 
                   file.name.toLowerCase().endsWith(ext))) {
        fileType = 'video';
      }

      return {
        file,
        id: `${Date.now()}-${Math.random()}`,
        type: fileType,
        status: 'pending',
        isPublic: false,
        ...(fileType === 'video' && { useGPU })
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
      formData.append('useGPU', (fileItem.useGPU || false).toString()); // GPU processing selection

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

  const toggleFileGPU = (fileId: string) => {
    setUploadedFiles(prev => prev.map(f => 
      f.id === fileId && f.type === 'video' ? { ...f, useGPU: !f.useGPU } : f
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
    
    // Fire and forget - don't block UI
    Promise.allSettled(warmingPromises);
  };

  return (
    <Card className="mb-8">
      <CardContent className="p-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 text-blue-500 mb-4">
            <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Documents & Videos</h3>
          <p className="text-gray-600 mb-6">
            Upload your documentation files and videos to train your chatbot. We support PDF, Markdown, HTML, Word Documents, Text files, <strong className="text-blue-600">CHM files</strong>, and <strong className="text-purple-600">Video files</strong>.
          </p>
          
          <div className="border-2 border-dashed border-blue-300 rounded-lg p-12 bg-gradient-to-br from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100 transition-all duration-200">
            <div className="space-y-4">
              <div className="mx-auto h-12 w-12 text-blue-500">
                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6" 
                  />
                </svg>
              </div>
              
              {/* GPU Processing Toggle for Videos */}
              <div className="mb-6">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useGPU}
                    onChange={(e) => setUseGPU(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="text-sm">
                    <span className="font-medium text-gray-900">Use GPU processing for videos</span>
                    <div className="text-gray-500">
                      {useGPU ? '⚡ Faster transcription (8x speed, higher cost)' : '💰 Standard CPU processing (cost-effective)'}
                    </div>
                  </div>
                </label>
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
                <p className="text-sm text-gray-500 mt-4">
                  <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                </p>
              </div>
              
              <p className="text-sm text-gray-500">
                Supports: PDF, MD, HTML, DOCX, TXT, CHM files + Video files (MP4, AVI, MOV, MKV, WebM, WMV) up to 10MB each
              </p>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.chm,.md,.html,.docx,.txt,.mp4,.avi,.mov,.mkv,.webm,.wmv,video/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* File List */}
        {uploadedFiles.length > 0 && (
          <div className="mt-8 space-y-3">
            <h4 className="text-sm font-medium text-gray-900 mb-4">Selected Files:</h4>
            {uploadedFiles.map((file) => (
              <div key={file.id} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                    {file.file.name}
                  </div>
                  <Badge variant={file.type === 'chm' ? 'default' : file.type === 'video' ? 'secondary' : 'secondary'}>
                    {file.type.toUpperCase()}
                  </Badge>
                  <button
                    onClick={() => toggleFilePrivacy(file.id)}
                    className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
                    disabled={file.status !== 'pending'}
                  >
                    {file.isPublic ? '🌐 Public' : '🔒 Private'}
                  </button>
                  {file.type === 'video' && (
                    <button
                      onClick={() => toggleFileGPU(file.id)}
                      className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
                      disabled={file.status !== 'pending'}
                    >
                      {file.useGPU ? '⚡ GPU' : '💻 CPU'}
                    </button>
                  )}
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
                      className="text-gray-600 hover:text-gray-700 hover:bg-gray-50"
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
              className="text-gray-600 hover:text-gray-700 hover:bg-gray-50"
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
      </CardContent>
    </Card>
  );
}
