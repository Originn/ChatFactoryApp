'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import UserDropdown from "@/components/dashboard/UserDropdown";
import { useParams } from 'next/navigation';

export default function ChatbotDocumentUploadPage() {
  const params = useParams();
  const chatbotId = params.id;
  
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
                    Upload your documentation files. We support PDF, Markdown, HTML, Word Documents, and Text files.
                  </p>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
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
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple />
                      </label>
                      <p className="pl-1 text-gray-500">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      PDF, MD, HTML, DOCX, TXT up to 10MB each
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Uploaded Files Preview Section */}
          <div className="mb-8">
            <h2 className="text-lg font-medium mb-4">Files Queued for Upload (0)</h2>
            <Card>
              <CardContent className="p-6 text-center text-gray-500">
                <p>No files selected yet. Upload files to see them here.</p>
              </CardContent>
            </Card>
          </div>

          {/* Embedding Results Preview */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Embedding Preview</h2>
              <div className="flex space-x-2">
                <Button variant="outline" className="text-sm" disabled>
                  Optimize Embeddings
                </Button>
                <Button className="text-sm bg-blue-600 hover:bg-blue-700" disabled>
                  Approve & Generate
                </Button>
              </div>
            </div>
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-500">
                  <p>Upload files to preview embedding results</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end space-x-4">
            <Button variant="outline" disabled>
              Save Draft
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" disabled>
              Complete
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
