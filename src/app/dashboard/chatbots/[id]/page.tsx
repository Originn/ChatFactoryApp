'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import UserDropdown from "@/components/dashboard/UserDropdown";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useRouter } from 'next/navigation';
import { db } from "@/lib/firebase/config";
import { doc, getDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";

// Define the Chatbot type
interface Chatbot {
  id: string;
  name: string;
  description: string;
  domain?: string;
  status: string;
  createdAt: any;
  updatedAt: any;
  userId: string;
  documents?: any[];
  deployedUrl?: string;
  deploymentId?: string;
  vercelProjectId?: string;
  vercelDeploymentId?: string;
  aiConfig?: {
    embeddingModel: string;
    llmModel: string;
    temperature: number;
    contextWindow: number;
  };
  behavior?: {
    persona: string;
    responseLength: string;
    systemPrompt: string;
  };
  appearance?: {
    primaryColor: string;
    bubbleStyle: string;
  };
  stats?: {
    queries: number;
    successRate: number;
    responseTime?: string;
  };
}

export default function ChatbotDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const chatbotId = params.id as string;
  
  // State
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'analytics' | 'settings'>('overview');
  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Check for chatbot creation success message
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const wasCreated = localStorage.getItem('chatbotCreated');
      const chatbotName = localStorage.getItem('chatbotName');
      
      if (wasCreated === 'true' && chatbotName) {
        setSuccessMessage(`Chatbot "${chatbotName}" was created successfully!`);
        // Clear the message from storage so it doesn't appear again on refresh
        localStorage.removeItem('chatbotCreated');
        localStorage.removeItem('chatbotName');
      }
    }
  }, []);
  
  // Fetch chatbot data
  useEffect(() => {
    async function fetchChatbotData() {
      if (!user || !chatbotId) {
        setIsLoading(false);
        return;
      }
      
      try {
        const chatbotRef = doc(db, "chatbots", chatbotId);
        const chatbotSnap = await getDoc(chatbotRef);
        
        if (chatbotSnap.exists()) {
          const chatbotData = chatbotSnap.data() as Omit<Chatbot, 'id'>;
          
          // Verify the chatbot belongs to the current user
          if (chatbotData.userId !== user.uid) {
            setError("You don't have permission to view this chatbot");
            setIsLoading(false);
            return;
          }
          
          setChatbot({
            id: chatbotSnap.id,
            ...chatbotData
          });
        } else {
          setError("Chatbot not found");
        }
      } catch (err: any) {
        console.error("Error fetching chatbot:", err);
        setError(err.message || "Failed to load chatbot");
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchChatbotData();
  }, [chatbotId, user]);
  
  // Handle delete chatbot
  const handleDeleteChatbot = async () => {
    if (!chatbot) return;
    
    if (!window.confirm("Are you sure you want to delete this chatbot? This action cannot be undone.")) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      // Get Vercel project info from the chatbot data
      const vercelProjectId = chatbot.vercelProjectId;
      const vercelProjectName = vercelProjectId || (chatbot.name ? 
        chatbot.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') : null);
      
      // Delete from Vercel if we have project info
      if (vercelProjectId || vercelProjectName) {
        try {
          console.log('Deleting from Vercel:', vercelProjectId || vercelProjectName);
          const vercelDeleteResponse = await fetch('/api/vercel-delete', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              projectId: vercelProjectId,
              projectName: vercelProjectName,
            }),
          });
          
          const vercelResult = await vercelDeleteResponse.json();
          
          if (vercelResult.success) {
            console.log('✅ Successfully deleted from Vercel:', vercelResult.message);
          } else {
            console.warn('⚠️ Failed to delete from Vercel:', vercelResult.error);
            // Continue with Firestore deletion even if Vercel deletion fails
          }
        } catch (vercelError) {
          console.error('❌ Error deleting from Vercel:', vercelError);
          // Continue with Firestore deletion even if Vercel deletion fails
        }
      } else {
        console.log('ℹ️ No Vercel project info found, skipping Vercel deletion');
      }
      
      // Delete from Firestore
      await deleteDoc(doc(db, "chatbots", chatbot.id));
      
      console.log('✅ Chatbot deleted successfully from both Vercel and Firestore');
      
      // Redirect to chatbots list
      router.push("/dashboard/chatbots");
    } catch (err: any) {
      console.error("Error deleting chatbot:", err);
      setError(`Failed to delete chatbot: ${err.message}`);
      setIsDeleting(false);
    }
  };

  // Handle deploy chatbot - Using the Vercel API
  const handleDeployChatbot = async () => {
    if (!chatbot) return;
    
    setIsDeploying(true);
    setDeploymentError(null);
    
    try {
      // Call our API route that handles Vercel deployment
      const response = await fetch('/api/vercel-deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatbotId: chatbot.id,
          chatbotName: chatbot.name
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to deploy chatbot');
      }
      
      // Update the chatbot directly in Firestore with deployment info
      const chatbotRef = doc(db, "chatbots", chatbot.id);
      await updateDoc(chatbotRef, {
        status: 'active',
        deployedUrl: data.url,
        vercelProjectId: data.projectName,
        vercelDeploymentId: data.deploymentId,
        deploymentTimestamp: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Update local state
      setChatbot({
        ...chatbot,
        status: 'active',
        deployedUrl: data.url,
      });
      
      setSuccessMessage(`Chatbot "${chatbot.name}" was deployed successfully! It's now available at: ${data.url}`);
      
      // Refresh the page after 2 seconds to show updated status
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (err: any) {
      console.error("Error deploying chatbot:", err);
      setDeploymentError(err.message || 'Failed to deploy chatbot. Please try again.');
    } finally {
      setIsDeploying(false);
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

      {/* Chatbot Detail Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
              <p className="font-medium">Error</p>
              <p>{error}</p>
              <div className="mt-4">
                <Button 
                  asChild
                  variant="outline"
                >
                  <Link href="/dashboard/chatbots">
                    Back to Chatbots
                  </Link>
                </Button>
              </div>
            </div>
          ) : chatbot ? (
            <>
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center">
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mr-4">
                    <span className="text-blue-600 font-bold text-xl">{chatbot.name.charAt(0)}</span>
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold text-gray-900">{chatbot.name}</h1>
                    <p className="text-sm text-gray-500">
                      {chatbot.domain ? 
                        chatbot.domain : 
                        `Created ${new Date(chatbot.createdAt.seconds * 1000).toLocaleDateString()}`
                      }
                    </p>
                  </div>
                </div>
                <div className="flex space-x-3">
                  <Button
                    asChild
                    variant="outline"
                  >
                    <Link href={`/dashboard/chatbots/${chatbotId}/edit`}>
                      Edit Chatbot
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 hover:text-red-800 hover:bg-red-50"
                    onClick={handleDeleteChatbot}
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Chatbot'}
                  </Button>
                  <Button
                    asChild
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Link href={`/dashboard/chatbots/${chatbotId}/documents`}>
                      Manage Documents
                    </Link>
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={handleDeployChatbot}
                    disabled={isDeploying || chatbot.status === 'active'}
                  >
                    {isDeploying ? 'Deploying...' : chatbot.status === 'active' ? 'Deployed' : 'Deploy Chatbot'}
                  </Button>
                </div>
              </div>

              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded mb-6">
                  {successMessage}
                </div>
              )}
              
              {deploymentError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-6">
                  {deploymentError}
                </div>
              )}

              {/* Tabs Navigation */}
              <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`${
                      activeTab === 'overview'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('documents')}
                    className={`${
                      activeTab === 'documents'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Documents
                  </button>
                  <button
                    onClick={() => setActiveTab('analytics')}
                    className={`${
                      activeTab === 'analytics'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Analytics
                  </button>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className={`${
                      activeTab === 'settings'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Settings
                  </button>
                </nav>
              </div>

              {/* Tab Content */}
              {activeTab === 'overview' && (
                <div>
                  {/* Overview Stats */}
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Status</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center">
                          <span className={`h-3 w-3 rounded-full ${
                            chatbot.status === 'active' ? 'bg-green-500' : 
                            chatbot.status === 'draft' ? 'bg-yellow-500' : 'bg-gray-500'
                          } mr-2`}></span>
                          <div className="text-xl font-bold capitalize">
                            {chatbot.status}
                          </div>
                        </div>
                        {chatbot.deployedUrl && (
                          <div className="mt-2 text-xs text-gray-500">
                            <a 
                              href={chatbot.deployedUrl.startsWith('http') ? chatbot.deployedUrl : `https://${chatbot.deployedUrl}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {chatbot.deployedUrl}
                            </a>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Documents</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{chatbot.documents?.length || 0}</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Success Rate</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{chatbot.stats?.successRate || 0}%</div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Model</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm font-medium">{chatbot.aiConfig?.llmModel || 'Not set'}</div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  {/* Chatbot Preview */}
                  <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Chatbot Preview</h2>
                  <Card className="max-w-md mx-auto">
                    <CardContent className="p-6">
                      <div className="border rounded-lg bg-gray-50 p-4 mb-4 h-60 overflow-y-auto">
                        {/* Simulated chat messages */}
                        <div className="flex items-start space-x-2 mb-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center">
                            <span style={{ color: chatbot.appearance?.primaryColor || '#3b82f6' }} className="font-bold text-sm">{chatbot.name.charAt(0)}</span>
                          </div>
                          <div className="bg-white rounded-lg p-2 shadow-sm max-w-xs">
                            <p className="text-sm">
                              Hello! I'm an AI assistant trained on {chatbot.name} documentation. How can I help you today?
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end mb-3">
                          <div 
                            className="p-2 max-w-xs rounded-lg text-white shadow-sm"
                            style={{ backgroundColor: chatbot.appearance?.primaryColor || '#3b82f6' }}
                          >
                            <p className="text-sm">How do I get started?</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center">
                            <span style={{ color: chatbot.appearance?.primaryColor || '#3b82f6' }} className="font-bold text-sm">{chatbot.name.charAt(0)}</span>
                          </div>
                          <div className="bg-white rounded-lg p-2 shadow-sm max-w-xs">
                            <p className="text-sm">
                              To get started, you'll need to sign up for an account and complete the onboarding process. 
                              Would you like me to guide you through the steps?
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="relative">
                        <input 
                          type="text" 
                          className="w-full px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Ask a question..."
                          disabled
                        />
                        <button 
                          className="absolute right-2 top-2 rounded-full p-1"
                          style={{ color: chatbot.appearance?.primaryColor || '#3b82f6' }}
                          disabled
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                          </svg>
                        </button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Recent Queries */}
                  <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Recent Queries</h2>
                  <Card>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Query
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Time
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Success
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {/* This would normally be populated with actual query data */}
                            <tr>
                              <td className="px-6 py-4">
                                <div className="text-sm text-gray-900">How do I reset my password?</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                5 minutes ago
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                  Success
                                </span>
                              </td>
                            </tr>
                            <tr>
                              <td className="px-6 py-4">
                                <div className="text-sm text-gray-900">What are the API rate limits?</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                10 minutes ago
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                  Success
                                </span>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'settings' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Chatbot Settings</h2>
                  
                  <div className="space-y-8">
                    {/* AI Configuration */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">AI Configuration</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-sm font-medium mb-2">Embedding Model</h4>
                            <p className="text-sm bg-gray-50 p-2 rounded border">
                              {chatbot.aiConfig?.embeddingModel || 'Not configured'}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium mb-2">LLM Model</h4>
                            <p className="text-sm bg-gray-50 p-2 rounded border">
                              {chatbot.aiConfig?.llmModel || 'Not configured'}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium mb-2">Temperature</h4>
                            <p className="text-sm bg-gray-50 p-2 rounded border">
                              {chatbot.aiConfig?.temperature || 'Default'}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium mb-2">Context Window</h4>
                            <p className="text-sm bg-gray-50 p-2 rounded border">
                              {chatbot.aiConfig?.contextWindow || 'Default'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Behavior */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Behavior Settings</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-sm font-medium mb-2">Persona</h4>
                            <p className="text-sm bg-gray-50 p-2 rounded border capitalize">
                              {chatbot.behavior?.persona || 'Default'}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium mb-2">Response Length</h4>
                            <p className="text-sm bg-gray-50 p-2 rounded border capitalize">
                              {chatbot.behavior?.responseLength || 'Default'}
                            </p>
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="text-sm font-medium mb-2">System Prompt</h4>
                          <div className="bg-gray-50 p-3 rounded border overflow-auto max-h-32">
                            <p className="text-sm whitespace-pre-wrap">
                              {chatbot.behavior?.systemPrompt || 'No system prompt configured.'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Appearance */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Appearance</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-sm font-medium mb-2">Primary Color</h4>
                            <div className="flex items-center space-x-2">
                              <div 
                                className="h-6 w-6 rounded border"
                                style={{ backgroundColor: chatbot.appearance?.primaryColor || '#3b82f6' }}
                              ></div>
                              <p className="text-sm">
                                {chatbot.appearance?.primaryColor || '#3b82f6'}
                              </p>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium mb-2">Bubble Style</h4>
                            <p className="text-sm bg-gray-50 p-2 rounded border capitalize">
                              {chatbot.appearance?.bubbleStyle || 'Default'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-4">
              <p className="font-medium">Chatbot not found</p>
              <p>The requested chatbot could not be found or you don't have permission to view it.</p>
              <div className="mt-4">
                <Button 
                  asChild
                  variant="outline"
                >
                  <Link href="/dashboard/chatbots">
                    Back to Chatbots
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}