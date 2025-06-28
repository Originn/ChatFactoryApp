'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import UserDropdown from "@/components/dashboard/UserDropdown";
import { useParams } from 'next/navigation';
import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface UploadedFile {
  file: File;
  id: string;
  type: 'regular' | 'chm';
  status: 'pending' | 'uploading' | 'converting' | 'completed' | 'error';
  progress?: number;
  jobId?: string;
  error?: string;
}

export default function ChatbotDocumentUploadPage() {
  const params = useParams();
  const chatbotId = params.id;
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = Array.from(files).map(file => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      type: file.name.toLowerCase().endsWith('.chm') ? 'chm' : 'regular',
      status: 'pending'
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (!files) return;

    const newFiles: UploadedFile[] = Array.from(files).map(file => ({
      file,
      id: `${Date.now()}-${Math.random()}`,
      type: file.name.toLowerCase().endsWith('.chm') ? 'chm' : 'regular',
      status: 'pending'
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const processCHMFile = async (fileItem: UploadedFile) => {
    try {
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, status: 'converting' } : f
      ));

      const formData = new FormData();
      formData.append('file', fileItem.file);
      formData.append('chatbotId', chatbotId as string);
      formData.append('userId', user?.uid || '');

      const response = await fetch('/api/chm-convert', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        if (result.status === 'queued') {
          // Start polling for status
          pollCHMStatus(fileItem.id, result.job_id);
        } else {
          setUploadedFiles(prev => prev.map(f => 
            f.id === fileItem.id ? { ...f, status: 'completed' } : f
          ));
        }
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

  const pollCHMStatus = async (fileId: string, jobId: string) => {
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/chm-convert?jobId=${jobId}`);
        const result = await response.json();

        if (result.success && result.status === 'completed') {
          setUploadedFiles(prev => prev.map(f => 
            f.id === fileId ? { ...f, status: 'completed' } : f
          ));
          return;
        }

        if (result.status === 'failed') {
          throw new Error(result.message || 'Conversion failed');
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        } else {
          throw new Error('Conversion timeout');
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

    poll();
  };

  const processRegularFile = async (fileItem: UploadedFile) => {
    try {
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileItem.id ? { ...f, status: 'uploading' } : f
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
          source: fileItem.file.name
        }),
      });

      const result = await response.json();

      if (result.success) {
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileItem.id ? { ...f, status: 'completed' } : f
        ));
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

  const handleUploadAll = async () => {
    setIsProcessing(true);
    
    for (const fileItem of uploadedFiles) {
      if (fileItem.status === 'pending') {
        if (fileItem.type === 'chm') {
          await processCHMFile(fileItem);
        } else {
          await processRegularFile(fileItem);
        }
      }
    }
    
    setIsProcessing(false);
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const getFileStatusDisplay = (file: UploadedFile) => {
    switch (file.status) {
      case 'pending':
        return { text: 'Ready to upload', color: 'text-gray-500' };
      case 'uploading':
        return { text: 'Uploading...', color: 'text-blue-500' };
      case 'converting':
        return { text: 'Converting CHM...', color: 'text-yellow-500' };
      case 'completed':
        return { text: 'Completed', color: 'text-green-500' };
      case 'error':
        return { text: `Error: ${file.error}`, color: 'text-red-500' };
      default:
        return { text: 'Unknown', color: 'text-gray-500' };
    }
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
                      PDF, MD, HTML, DOCX, TXT, CHM up to 10MB each
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
                                {fileItem.type === 'chm' && ' • CHM file will be converted to PDF'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
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
