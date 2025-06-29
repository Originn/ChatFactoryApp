'use client';

import { Button } from "@/components/ui/button";
import Link from "next/link";
import UserDropdown from "@/components/dashboard/UserDropdown";
import UserPDFManager from "@/components/dashboard/UserPDFManager";

export default function PDFManagementPage() {
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
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Chatbots
                </Link>
                <Link
                  href="/dashboard/pdfs"
                  className="border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  My PDFs
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

      {/* PDF Management Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">My CHM PDFs</h1>
              <p className="text-gray-600 mt-1">
                Manage your uploaded CHM files that have been converted to PDFs
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/chatbots">
                Upload More Files
              </Link>
            </Button>
          </div>

          {/* PDF Manager Component */}
          <UserPDFManager showChatbotFilter={true} />

          {/* Help Section */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-blue-900 mb-2">About Your CHM PDFs</h3>
            <div className="text-blue-800 space-y-2">
              <p>
                <strong>🔓 Public PDFs:</strong> Can be accessed by anyone with the direct link. 
                Great for documentation you want to share publicly.
              </p>
              <p>
                <strong>🔒 Private PDFs:</strong> Only accessible to you through secure, expiring links. 
                Perfect for sensitive or proprietary documentation.
              </p>
              <p>
                <strong>📄 PDF Access:</strong> All your CHM files are converted to searchable PDFs and 
                used to power your chatbots with accurate document search.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
