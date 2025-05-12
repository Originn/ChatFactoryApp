'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import UserDropdown from "@/components/dashboard/UserDropdown";

export default function DocumentUploadPage() {
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
            <h1 className="text-2xl font-semibold text-gray-900">Upload Documents</h1>
            <Button
              as={Link}
              href="/dashboard/documents"
              variant="outline"
            >
              Back to Documents
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
            <h2 className="text-lg font-medium mb-4">Uploaded Files (3)</h2>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          File Name
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Size
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th scope="col" className="relative px-6 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <svg className="h-5 w-5 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm font-medium text-gray-900">product-documentation.pdf</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          PDF
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          2.4 MB
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Processed
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button className="text-red-600 hover:text-red-900">
                            Remove
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <svg className="h-5 w-5 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm font-medium text-gray-900">getting-started.md</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          Markdown
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          156 KB
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            Processed
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button className="text-red-600 hover:text-red-900">
                            Remove
                          </button>
                        </td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <svg className="h-5 w-5 text-gray-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm font-medium text-gray-900">api-reference.html</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          HTML
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          342 KB
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            Processing
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button className="text-red-600 hover:text-red-900">
                            Remove
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Embedding Results Preview */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Embedding Preview</h2>
              <div className="flex space-x-2">
                <Button variant="outline" className="text-sm">
                  Optimize Embeddings
                </Button>
                <Button className="text-sm bg-blue-600 hover:bg-blue-700">
                  Approve & Generate
                </Button>
              </div>
            </div>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-md font-medium mb-2">Document Chunking Results</h3>
                    <div className="bg-gray-50 border rounded p-4 max-h-64 overflow-y-auto">
                      <ul className="space-y-4">
                        <li className="border-b pb-3">
                          <div className="flex justify-between">
                            <h4 className="text-sm font-medium">Chunk #1</h4>
                            <span className="text-xs text-gray-500">256 tokens</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Getting Started with Our API. This document provides an overview of our REST API endpoints and authentication methods. Before you begin, make sure you have an API key.
                          </p>
                        </li>
                        <li className="border-b pb-3">
                          <div className="flex justify-between">
                            <h4 className="text-sm font-medium">Chunk #2</h4>
                            <span className="text-xs text-gray-500">312 tokens</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Authentication. All API requests require authentication using your API key. You can pass this as a header or as a query parameter. We recommend using headers for better security.
                          </p>
                        </li>
                        <li className="border-b pb-3">
                          <div className="flex justify-between">
                            <h4 className="text-sm font-medium">Chunk #3</h4>
                            <span className="text-xs text-gray-500">196 tokens</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Endpoints. Our API provides several endpoints for different operations. The base URL for all API requests is https://api.example.com/v1/.
                          </p>
                        </li>
                        <li>
                          <div className="flex justify-between">
                            <h4 className="text-sm font-medium">Chunk #4</h4>
                            <span className="text-xs text-gray-500">287 tokens</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Rate Limiting. To ensure the stability of our service, we implement rate limiting. By default, you can make up to 100 requests per minute. If you exceed this limit, you'll receive a 429 Too Many Requests response.
                          </p>
                        </li>
                      </ul>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-md font-medium mb-2">AI Optimization Suggestions</h3>
                    <div className="bg-blue-50 border border-blue-200 rounded p-4">
                      <h4 className="text-sm font-medium text-blue-800 mb-2">Suggested Improvements:</h4>
                      <ul className="space-y-2 text-sm text-blue-700">
                        <li className="flex items-start">
                          <svg className="h-5 w-5 text-blue-600 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span>Merge chunks #1 and #2 for better context preservation</span>
                        </li>
                        <li className="flex items-start">
                          <svg className="h-5 w-5 text-blue-600 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span>Split chunk #4 into smaller chunks for more precise answers</span>
                        </li>
                        <li className="flex items-start">
                          <svg className="h-5 w-5 text-blue-600 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          <span>Add metadata tags to improve search and retrieval</span>
                        </li>
                      </ul>
                      
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <Button variant="outline" className="text-sm">
                          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          Apply Option 1
                        </Button>
                        <Button variant="outline" className="text-sm">
                          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          Apply Option 2
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end space-x-4">
            <Button variant="outline">
              Save Draft
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Complete & Build Chatbot
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
