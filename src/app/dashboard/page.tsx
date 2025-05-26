'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import UserDropdown from "@/components/dashboard/UserDropdown";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";

// Define the Chatbot type
interface Chatbot {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: any;
  updatedAt: any;
  documents?: any[];
  stats?: {
    queries: number;
    successRate: number;
  };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalChatbots: 0,
    totalDocuments: 0,
    totalQueries: 0,
    successRate: 0
  });

  useEffect(() => {
    async function fetchData() {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      try {
        // Fetch chatbots (limited to 5 most recent)
        const chatbotsQuery = query(
          collection(db, "chatbots"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        
        const chatbotsSnapshot = await getDocs(chatbotsQuery);
        const chatbotsList: Chatbot[] = [];
        let totalDocs = 0;
        let totalQueries = 0;
        let successRateSum = 0;
        let successRateCount = 0;
        
        chatbotsSnapshot.forEach((doc) => {
          const data = doc.data() as Omit<Chatbot, 'id'>;
          chatbotsList.push({
            id: doc.id,
            ...data
          });
          
          // Accumulate stats
          totalDocs += (data.documents?.length || 0);
          totalQueries += (data.stats?.queries || 0);
          
          if (data.stats?.successRate !== undefined) {
            successRateSum += data.stats.successRate;
            successRateCount++;
          }
        });
        
        setChatbots(chatbotsList);
        
        // Update stats
        setStats({
          totalChatbots: chatbotsSnapshot.size,
          totalDocuments: totalDocs,
          totalQueries: totalQueries,
          successRate: successRateCount ? Math.round(successRateSum / successRateCount) : 0
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [user]);
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center font-bold text-xl">
                Chat Factory
              </div>
              <nav className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/dashboard"
                  className="border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
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
                  href="/dashboard/settings"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Settings
                </Link>
              </nav>
            </div>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Button
                  asChild
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Link href="/dashboard/chatbots/new">
                    Create New Chatbot
                  </Link>
                </Button>
              </div>
              <UserDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Dashboard Overview</h1>
          
          {/* Stats */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total Chatbots</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalChatbots}</div>
                <p className="text-xs text-gray-500 mt-1">Your AI assistants</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalDocuments}</div>
                <p className="text-xs text-gray-500 mt-1">Added to chatbots</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">User Queries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.totalQueries}</div>
                <p className="text-xs text-gray-500 mt-1">Questions answered</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.successRate}%</div>
                <p className="text-xs text-gray-500 mt-1">Average across chatbots</p>
              </CardContent>
            </Card>
          </div>

          {/* Active Chatbots */}
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Your Chatbots</h2>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : chatbots.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                  <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={1} 
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No chatbots yet</h3>
                <p className="text-sm text-gray-500 mb-4">Get started by creating your first chatbot</p>
                <Button 
                  asChild
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Link href="/dashboard/chatbots/new">
                    Create Your First Chatbot
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Documents
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Queries
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Updated
                      </th>
                      <th scope="col" className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {chatbots.map((chatbot) => {
                      // Format the date if available
                      const lastUpdated = chatbot.updatedAt ? 
                        new Date(chatbot.updatedAt.seconds * 1000).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : 'N/A';
                        
                      return (
                        <tr key={chatbot.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-blue-600 font-bold">{chatbot.name.charAt(0)}</span>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{chatbot.name}</div>
                                <div className="text-sm text-gray-500">{chatbot.description || 'No description'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              chatbot.status === 'active' 
                                ? 'bg-green-100 text-green-800'
                                : chatbot.status === 'draft'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {chatbot.status === 'active' ? 'Active' : 
                               chatbot.status === 'draft' ? 'Draft' : chatbot.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {chatbot.documents?.length || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {chatbot.stats?.queries || 0}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {lastUpdated}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <Link href={`/dashboard/chatbots/${chatbot.id}`} className="text-blue-600 hover:text-blue-900 mr-4">
                              View
                            </Link>
                            <Link href={`/dashboard/chatbots/${chatbot.id}/edit`} className="text-blue-600 hover:text-blue-900 mr-4">
                              Edit
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          )}

          {/* Quick Actions */}
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Card className="hover:shadow-lg transition-shadow border-blue-200">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">Create New Chatbot</h3>
                <p className="text-sm text-gray-500 mb-4">Set up a new AI assistant for your documentation.</p>
                <Button asChild variant="outline" className="mt-auto">
                  <Link href="/dashboard/chatbots/new">
                    Get Started
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow border-blue-200">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">Upload Documents</h3>
                <p className="text-sm text-gray-500 mb-4">Add new documentation files to your knowledge base.</p>
                <Button asChild variant="outline" className="mt-auto">
                  <Link href="/dashboard/documents/upload">
                    Upload Files
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow border-blue-200">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                  <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">View Analytics</h3>
                <p className="text-sm text-gray-500 mb-4">See detailed performance metrics for your chatbots.</p>
                <Button as={Link} href="/dashboard/analytics" variant="outline" className="mt-auto">
                  View Reports
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
