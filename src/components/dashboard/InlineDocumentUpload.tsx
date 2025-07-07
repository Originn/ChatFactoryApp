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
  type: 'regular' | 'chm' | 'pdf';
  status: 'pending' | 'uploading' | 'converting' | 'converting_chm' | 'generating_embeddings' | 'completed' | 'completed_pdf_only' | 'error';
  progress?: number;
  jobId?: string;
  error?: string;
  isPublic: boolean;
  vectorCount?: number;
  embeddingModel?: string;
  embeddingError?: string;
  pipelineStage?: 'chm_conversion' | 'embedding_generation' | 'completed';
  pineconeIndex?: string;
  mode?: 'enhanced_complete' | 'pdf_only' | 'legacy';
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

  const getProgressForCHM = (status: string, elapsed: number) => {
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
  };

  const getStatusMessage = (file: UploadedFile) => {
    switch(file.status) {
      case 'pending':
        return 'Ready to upload';
      case 'uploading':
        return 'Uploading file...';
      case 'converting_chm':
        return 'Converting CHM to PDF...';
      case 'generating_embeddings':
        return `Generating embeddings${file.embeddingModel ? ` with ${file.embeddingModel}` : ''}...`;
      case 'completed':
        if (file.type === 'chm') {
          return '✅ Conversion and ingestion completed successfully';
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
      let fileType: 'regular' | 'chm' | 'pdf' = 'regular';
      
      if (file.name.toLowerCase().endsWith('.chm')) {
        fileType = 'chm';
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        fileType = 'pdf';
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
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (!files) return;

    const newFiles: UploadedFile[] = Array.from(files).map(file => {
      let fileType: 'regular' | 'chm' | 'pdf' = 'regular';
      
      if (file.name.toLowerCase().endsWith('.chm')) {
        fileType = 'chm';
      } else if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        fileType = 'pdf';
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
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const startEstimatedProgress = (fileId: string) => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      
      setUploadedFiles(prev => prev.map(f => {
        if (f.id === fileId && (f.status === 'converting_chm' || f.status === 'generating_embeddings')) {
          const newProgress = getProgressForCHM(f.status, elapsed);
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

      const progressInterval = startEstimatedProgress(fileItem.id);

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

  const uploadFiles = async () => {
    if (!user?.uid) return;

    setIsProcessing(true);
    
    for (const file of uploadedFiles.filter(f => f.status === 'pending')) {
      if (file.type === 'chm') {
        await processCHMFile(file, file.isPublic);
      } else if (file.type === 'pdf') {
        await processPDFFile(file, file.isPublic);
      }
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Documents</h3>
          <p className="text-gray-600 mb-6">
            Upload your documentation files to train your chatbot. We support PDF, Markdown, HTML, Word Documents, Text files, and <strong className="text-blue-600">CHM files</strong>.
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
                Supports: PDF, MD, HTML, DOCX, TXT, CHM files up to 10MB each
              </p>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.chm,.md,.html,.docx,.txt"
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
                  <Badge variant={file.type === 'chm' ? 'default' : 'secondary'}>
                    {file.type.toUpperCase()}
                  </Badge>
                  <button
                    onClick={() => toggleFilePrivacy(file.id)}
                    className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
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
                </div>
              </div>
            ))}
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
