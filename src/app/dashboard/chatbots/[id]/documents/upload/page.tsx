'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import UserDropdown from "@/components/dashboard/UserDropdown";
import { useParams } from 'next/navigation';
import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip } from '@/components/ui/custom-tooltip';

interface UploadedFile {
  file: File;
  id: string;
  type: 'regular' | 'chm' | 'pdf';
  status: 'pending' | 'uploading' | 'converting' | 'converting_chm' | 'generating_embeddings' | 'completed' | 'completed_pdf_only' | 'error';
  progress?: number;
  jobId?: string;
  error?: string;
  isPublic: boolean;
  // Enhanced fields for CHM pipeline tracking
  vectorCount?: number;
  embeddingModel?: string;
  embeddingError?: string;
  pipelineStage?: 'chm_conversion' | 'embedding_generation' | 'completed';
  pineconeIndex?: string;
  mode?: 'enhanced_complete' | 'pdf_only' | 'legacy';
}

export default function ChatbotDocumentUploadPage() {
  const params = useParams();
  const chatbotId = params.id;
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Helper functions for enhanced progress tracking
  const getProgressForCHM = (status: string, elapsed: number) => {
    switch(status) {
      case 'converting_chm': 
        return Math.min(10 + (elapsed * 0.8), 60); // 10-60% for CHM→PDF
      case 'generating_embeddings':
        return Math.min(60 + (elapsed * 0.4), 95);  // 60-95% for embeddings
      case 'completed':
      case 'completed_pdf_only':
        return 100;
      default:
        return Math.min(elapsed * 2, 10); // Initial upload
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
        isPublic: false // ✨ Default to private for security
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
        isPublic: false // ✨ Default to private for security
      };
    });

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const processCHMFile = async (fileItem: UploadedFile, isPublic: boolean = false) => {
    try {
      // Set initial status - CHM conversion phase
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { 
          ...f, 
          status: 'converting_chm', 
          progress: 10,
          pipelineStage: 'chm_conversion',
          isPublic 
        } : f
      ));

      // Start estimated progress animation
      const progressInterval = startEstimatedProgress(fileItem.id);

      const formData = new FormData();
      formData.append('file', fileItem.file);
      formData.append('chatbotId', chatbotId as string);
      formData.append('userId', user?.uid || '');
      formData.append('isPublic', isPublic.toString());

      const response = await fetch('/api/chm-convert', {
        method: 'POST',
        body: formData,
      });

      // Clear progress animation
      clearInterval(progressInterval);

      const result = await response.json();

      if (result.success) {
        // Check the completion mode
        if (result.mode === 'enhanced_complete') {
          // Full pipeline completed successfully
          setUploadedFiles(prev => prev.map(f => 
            f.id === fileItem.id ? { 
              ...f, 
              status: 'completed',
              progress: 100,
              vectorCount: result.vectorCount,
              embeddingModel: result.embeddingConfig || result.embeddingModel,
              pineconeIndex: result.vectorstore || result.pineconeIndex,
              pipelineStage: 'completed',
              mode: 'enhanced_complete',
              isPublic
            } : f
          ));
          console.log(`✅ Enhanced CHM processing completed: ${result.vectorCount} vectors created`);
        } else {
          // PDF only mode (legacy or embedding failed)
          setUploadedFiles(prev => prev.map(f => 
            f.id === fileItem.id ? { 
              ...f, 
              status: 'completed_pdf_only',
              progress: 100,
              vectorCount: result.vectorCount || 0,
              embeddingError: result.embeddingError || 'Embeddings not configured',
              pipelineStage: 'completed',
              mode: result.mode || 'pdf_only',
              isPublic
            } : f
          ));
          console.log(`✅ CHM to PDF completed. Mode: ${result.mode}`);
        }
      } else if (result.processing && result.jobId) {
        // Job is queued/processing - start enhanced polling
        console.log(`⏳ CHM processing queued/in-progress: ${result.status} (Job ID: ${result.jobId})`);
        
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'converting_chm',
            progress: 20,
            pipelineStage: 'chm_conversion',
            isPublic
          } : f
        ));

        // Poll for completion with enhanced tracking
        await pollJobCompletionEnhanced(result.jobId, fileItem.id, isPublic);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { 
          ...f, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Conversion failed'
        } : f
      ));
    }
  };

  // Helper function for estimated progress
  const startEstimatedProgress = (fileId: string) => {
    let elapsed = 0;
    
    return setInterval(() => {
      elapsed += 2; // 2 seconds per tick
      
      let progress = 10;
      let status = 'converting_chm';
      let stage = 'chm_conversion';
      
      if (elapsed < 60) {
        // First minute: CHM→PDF conversion (10-40%)
        progress = 10 + (elapsed * 0.5);
        status = 'converting_chm';
        stage = 'chm_conversion';
      } else if (elapsed < 240) {
        // Next 3 minutes: Embedding generation (40-90%)
        progress = 40 + ((elapsed - 60) * 0.28);
        status = 'generating_embeddings';
        stage = 'embedding_generation';
      } else {
        // Beyond 4 minutes: Slow crawl to 95%
        progress = Math.min(90 + ((elapsed - 240) * 0.02), 95);
        status = 'generating_embeddings';
        stage = 'embedding_generation';
      }
      
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          status: status as any,
          progress: Math.round(progress),
          pipelineStage: stage as any
        } : f
      ));
    }, 2000); // Update every 2 seconds
  };

  const pollJobCompletionEnhanced = async (jobId: string, fileId: string, isPublic: boolean) => {
    const maxAttempts = 120; // 20 minutes max (10 seconds interval)
    let attempts = 0;

    const poll = async () => {
      try {
        attempts++;
        
        const response = await fetch(`/api/chm-convert?jobId=${jobId}`);
        const result = await response.json();

        if (result.success && result.completed) {
          // Job completed successfully - check mode
          const isEnhancedComplete = result.vectorCount > 0;
          
          setUploadedFiles(prev => prev.map(f => 
            f.id === fileId ? { 
              ...f, 
              status: isEnhancedComplete ? 'completed' : 'completed_pdf_only',
              progress: 100,
              vectorCount: result.vectorCount || 0,
              embeddingError: result.embeddingError,
              pipelineStage: 'completed',
              mode: isEnhancedComplete ? 'enhanced_complete' : 'pdf_only',
              isPublic
            } : f
          ));
          
          console.log(`✅ CHM processing completed: ${result.vectorCount || 0} vectors created`);
          return;
        } else if (result.completed) {
          // Job failed
          throw new Error(result.error || 'Processing failed');
        } else if (attempts >= maxAttempts) {
          // Timeout
          throw new Error('Processing timed out after 20 minutes');
        } else {
          // Still processing - update progress based on estimated pipeline stage
          let progress = 10;
          let status = 'converting_chm';
          let stage = 'chm_conversion';
          
          // After 5 minutes (30 attempts), assume we're in embedding generation phase
          if (attempts > 30) {
            progress = Math.min(60 + ((attempts - 30) * 0.5), 95);
            status = 'generating_embeddings';
            stage = 'embedding_generation';
          } else {
            // CHM to PDF phase
            progress = Math.min(10 + (attempts * 1.5), 60);
          }
          
          setUploadedFiles(prev => prev.map(f => 
            f.id === fileId ? { 
              ...f, 
              status: status as any,
              progress: Math.round(progress),
              pipelineStage: stage as any,
              isPublic
            } : f
          ));
          
          // Continue polling after 10 seconds
          setTimeout(poll, 10000);
        }
      } catch (error) {
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileId ? { 
            ...f, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Polling failed'
          } : f
        ));
      }
    };

    // Start polling
    poll();
  };

  const processPDFFile = async (fileItem: UploadedFile, isPublic: boolean = false) => {
    try {
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, status: 'converting', isPublic } : f
      ));

      const formData = new FormData();
      formData.append('file', fileItem.file);
      formData.append('chatbotId', chatbotId as string);
      formData.append('userId', user?.uid || '');
      formData.append('isPublic', isPublic.toString());

      const response = await fetch('/api/pdf-convert', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { 
            ...f, 
            status: 'completed',
            progress: 100,
            isPublic
          } : f
        ));
        console.log(`✅ PDF processed: ${result.vectorCount} vectors created`);
        console.log(`🤖 Embedding: ${result.embeddingConfig}`);
        console.log(`📊 Vectorstore: ${result.vectorstore}`);
        console.log(`🔒 Access level: ${isPublic ? 'Public' : 'Private'}`);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { 
          ...f, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'PDF processing failed'
        } : f
      ));
    }
  };

  const getFileStatusDisplay = (file: UploadedFile) => {
    const accessBadge = (file.status === 'completed' || file.status === 'completed_pdf_only') ? 
      ` (${file.isPublic ? '🔓 Public' : '🔒 Private'})` : '';
    
    // Use enhanced status message helper for CHM files
    if (file.type === 'chm') {
      const message = getStatusMessage(file);
      let color = 'text-gray-500';
      
      switch (file.status) {
        case 'pending':
          color = 'text-gray-500';
          break;
        case 'uploading':
          color = 'text-blue-500';
          break;
        case 'converting_chm':
          color = 'text-yellow-500';
          break;
        case 'generating_embeddings':
          color = 'text-orange-500';
          break;
        case 'completed':
          color = 'text-green-500';
          break;
        case 'completed_pdf_only':
          color = 'text-yellow-600';
          break;
        case 'error':
          color = 'text-red-500';
          break;
      }
      
      return { 
        text: message + accessBadge, 
        color,
        showProgress: ['converting_chm', 'generating_embeddings'].includes(file.status),
        progress: file.progress || 0
      };
    }
    
    // Original logic for non-CHM files
    switch (file.status) {
      case 'pending':
        return { text: 'Ready to upload', color: 'text-gray-500' };
      case 'uploading':
        return { text: 'Uploading...', color: 'text-blue-500' };
      case 'converting':
        if (file.type === 'pdf') {
          return { text: 'Processing PDF & vectorizing...', color: 'text-yellow-500' };
        } else {
          return { text: 'Processing...', color: 'text-yellow-500' };
        }
      case 'completed':
        let completedText = 'Completed';
        if (file.type === 'pdf') {
          completedText = 'PDF processed & vectorized';
        }
        return { 
          text: completedText + accessBadge, 
          color: 'text-green-500' 
        };
      case 'error':
        return { text: `Error: ${file.error}`, color: 'text-red-500' };
      default:
        return { text: 'Unknown', color: 'text-gray-500' };
    }
  };

  const processRegularFile = async (fileItem: UploadedFile, isPublic: boolean = false) => {
    try {
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, status: 'uploading', isPublic } : f
      ));

      // Extract text content based on file type
      let textContent = '';
      const text = await fileItem.file.text();
      textContent = text;

      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatbotId,
          userId: user?.uid,
          documentName: fileItem.file.name,
          documentType: fileItem.file.type,
          textContent,
          source: fileItem.file.name,
          isPublic // ✨ NEW: Pass public/private choice for regular files too
        }),
      });

      const result = await response.json();

      if (result.success) {
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, status: 'completed', isPublic } : f
        ));
        console.log(`🔒 Regular file access level: ${isPublic ? 'Public' : 'Private'}`);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { 
          ...f, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Upload failed'
        } : f
      ));
    }
  };

  // ✨ Handle checkbox change for public/private access
  const handlePublicToggle = (fileId: string, isPublic: boolean) => {
    setUploadedFiles(prev => prev.map(file => 
      file.id === fileId ? { ...file, isPublic } : file
    ));
  };

  // ✨ Upload files using their individual public/private settings
  const handleUploadAll = async () => {
    setIsProcessing(true);
    
    for (const fileItem of uploadedFiles) {
      if (fileItem.status === 'pending') {
        if (fileItem.type === 'chm') {
          await processCHMFile(fileItem, fileItem.isPublic);
        } else if (fileItem.type === 'pdf') {
          await processPDFFile(fileItem, fileItem.isPublic);
        } else {
          await processRegularFile(fileItem, fileItem.isPublic);
        }
      }
    }
    
    setIsProcessing(false);
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center font-bold text-xl">
                DocsAI
              </div>
              <nav className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/dashboard"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/chatbots"
                  className="border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Chatbots
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Settings
                </Link>
              </nav>
            </div>
            <div className="flex items-center">
              <UserDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Upload Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold text-gray-900">Upload Documents for Chatbot</h1>
            <Button
              asChild
              variant="outline"
            >
              <Link href={`/dashboard/chatbots/${chatbotId}`}>
                Back to Chatbot
              </Link>
            </Button>
          </div>

          <div className="mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">Upload Files</h2>
                  <p className="text-gray-500">
                    Upload your documentation files. We support PDF, Markdown, HTML, Word Documents, Text files, and <strong>CHM files</strong>.
                  </p>
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors"
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                  >
                    <div className="mx-auto h-12 w-12 text-gray-400">
                      <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={1} 
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
                        />
                      </svg>
                    </div>
                    <div className="mt-4 flex text-sm justify-center">
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500"
                      >
                        <span>Upload files</span>
                        <input 
                          ref={fileInputRef}
                          id="file-upload" 
                          name="file-upload" 
                          type="file" 
                          className="sr-only" 
                          multiple 
                          accept=".pdf,.md,.html,.docx,.txt,.chm"
                          onChange={handleFileSelect}
                        />
                      </label>
                      <p className="pl-1 text-gray-500">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      PDF, MD, HTML, DOCX, TXT, CHM up to 10MB each • PDFs use AI embeddings
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Uploaded Files Preview Section */}
          <div className="mb-8">
            <h2 className="text-lg font-medium mb-4">Files Queued for Upload ({uploadedFiles.length})</h2>
            <Card>
              <CardContent className="p-6">
                {uploadedFiles.length === 0 ? (
                  <div className="text-center text-gray-500">
                    <p>No files selected yet. Upload files to see them here.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {uploadedFiles.map((fileItem) => {
                      const statusDisplay = getFileStatusDisplay(fileItem);
                      return (
                        <div key={fileItem.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              {fileItem.type === 'chm' ? (
                                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                                  <span className="text-orange-600 text-xs font-semibold">CHM</span>
                                </div>
                              ) : fileItem.type === 'pdf' ? (
                                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                                  <span className="text-red-600 text-xs font-semibold">PDF</span>
                                </div>
                              ) : (
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                  <span className="text-blue-600 text-xs font-semibold">DOC</span>
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{fileItem.file.name}</p>
                              <p className="text-xs text-gray-500">
                                {(fileItem.file.size / 1024 / 1024).toFixed(2)} MB
                                {fileItem.type === 'chm' && ' • CHM file will be converted to PDF + embeddings'}
                                {fileItem.type === 'pdf' && ' • PDF will be processed with AI embeddings'}
                              </p>
                              
                              {/* Enhanced Progress Bar for CHM Pipeline */}
                              {fileItem.type === 'chm' && statusDisplay.showProgress && (
                                <div className="mt-2">
                                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>
                                      {fileItem.pipelineStage === 'chm_conversion' && '🔄 Converting CHM to PDF'}
                                      {fileItem.pipelineStage === 'embedding_generation' && '🧠 Generating embeddings'}
                                    </span>
                                    <span>{Math.round(statusDisplay.progress || 0)}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div 
                                      className={`h-1.5 rounded-full transition-all duration-500 ${
                                        fileItem.pipelineStage === 'chm_conversion' 
                                          ? 'bg-yellow-500' 
                                          : 'bg-orange-500'
                                      }`}
                                      style={{ width: `${Math.min(statusDisplay.progress || 0, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* ✨ Public/Private Checkbox with Professional Tooltip */}
                          <div className="flex items-center space-x-4">
                            {fileItem.status === 'pending' && (
                              <div className="flex items-center space-x-2">
                                <Tooltip 
                                  content={fileItem.isPublic 
                                    ? "Public: Chatbot users can access this PDF and see it as a source reference. Good for showing documentation sources."
                                    : "Private: PDF is private and chatbot users cannot access it directly. Users won't see source references."
                                  }
                                  side="top"
                                >
                                  <label className="flex items-center space-x-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={fileItem.isPublic}
                                      onChange={(e) => handlePublicToggle(fileItem.id, e.target.checked)}
                                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                                    />
                                    <span className="text-sm font-medium text-gray-700">
                                      {fileItem.isPublic ? '🔓 Public' : '🔒 Private'}
                                    </span>
                                  </label>
                                </Tooltip>
                              </div>
                            )}
                            
                            <span className={`text-sm ${statusDisplay.color}`}>
                              {statusDisplay.text}
                            </span>
                            
                            {fileItem.status === 'pending' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => removeFile(fileItem.id)}
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end space-x-4">
            <Button 
              variant="outline" 
              disabled={uploadedFiles.length === 0}
              onClick={() => setUploadedFiles([])}
            >
              Clear All
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700" 
              disabled={uploadedFiles.length === 0 || isProcessing}
              onClick={handleUploadAll}
            >
              {isProcessing ? 'Processing...' : 'Upload All Files'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
