'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import UserDropdown from "@/components/dashboard/UserDropdown";
import { useAuth } from "@/contexts/AuthContext";

export default function ChatbotsPage() {
  const { user } = useAuth();
  
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
              <div className="flex-shrink-0 mr-4">
                <Button
                  as={Link}
                  href="/dashboard/chatbots/new"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Create New Chatbot
                </Button>
              </div>
              <UserDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Chatbots Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Your Chatbots</h1>
          
          {/* Empty State (when no chatbots) */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-center">
            <div className="mx-auto h-12 w-12 text-gray-400">
              <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1} 
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
                />
              </svg>
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No chatbots</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new chatbot.</p>
            <div className="mt-6">
              <Button 
                asChild
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Link href="/dashboard/chatbots/new">
                  Create Your First Chatbot
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
