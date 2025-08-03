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
import { deleteChatbotFolder } from "@/lib/utils/logoUpload";
import { ChatbotDeletionDialog } from '@/components/dialogs/ChatbotDeletionDialog';
import { VectorStoreSelectionDialog } from '@/components/dialogs/VectorStoreSelectionDialog';
import { VectorStoreNameDialog } from '@/components/dialogs/VectorStoreNameDialog';
import ChatbotUserManagement from '@/components/dashboard/ChatbotUserManagement';
import UserPDFManager from '@/components/dashboard/UserPDFManager';
import InlineDocumentUpload from '@/components/dashboard/InlineDocumentUpload';
import { ClientFirebaseProjectService } from '@/services/clientFirebaseProjectService';
import { ChatbotConfig } from '@/types/chatbot';

export default function ChatbotDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const chatbotId = params.id as string;
  
  // State variables
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'users' | 'analytics' | 'settings'>('overview');
  const [chatbot, setChatbot] = useState<ChatbotConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasVectorstore, setHasVectorstore] = useState(false);
  const [vectorstoreDocCount, setVectorstoreDocCount] = useState(0);
  const [vectorStoreName, setVectorStoreName] = useState<string>('');
  const [vectorStoreIndexName, setVectorStoreIndexName] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Vector store deployment dialogs
  const [showVectorStoreSelection, setShowVectorStoreSelection] = useState(false);
  const [showVectorStoreNaming, setShowVectorStoreNaming] = useState(false);
  const [selectedVectorStore, setSelectedVectorStore] = useState<{
    indexName: string;
    displayName: string;
  } | null>(null);

  // Check for chatbot creation success message
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const wasCreated = localStorage.getItem('chatbotCreated');
      const chatbotName = localStorage.getItem('chatbotName');
      
      if (wasCreated === 'true' && chatbotName) {
        setSuccessMessage(`Chatbot "${chatbotName}" was created successfully!`);
        localStorage.removeItem('chatbotCreated');
        localStorage.removeItem('chatbotName');
      }
    }
  }, []);

  // Check if vectorstore exists for this chatbot
  const checkVectorstoreExists = async (chatbotId: string): Promise<boolean> => {
    try {
      console.log('🔍 Checking if vectorstore exists for chatbot:', chatbotId);
      
      const chatbotRef = doc(db, "chatbots", chatbotId);
      const chatbotSnap = await getDoc(chatbotRef);
      
      if (chatbotSnap.exists()) {
        const chatbotData = chatbotSnap.data();
        const assignedIndexName = chatbotData.vectorstore?.indexName;
        const vectorstoreDisplayName = chatbotData.vectorstore?.displayName || 'Knowledge Base';
        
        if (assignedIndexName) {
          console.log('✅ Chatbot has assigned vectorstore:', assignedIndexName);
          
          setVectorStoreIndexName(assignedIndexName);
          setVectorStoreName(vectorstoreDisplayName);
          setHasVectorstore(true);
          
          return true;
        } else {
          console.log('❌ No vectorstore assigned to chatbot');
          setHasVectorstore(false);
          return false;
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error checking vectorstore:', error);
      return false;
    }
  };

  useEffect(() => {
    const fetchChatbot = async () => {
      try {
        const docRef = doc(db, 'chatbots', chatbotId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const chatbotData = { id: docSnap.id, ...docSnap.data() } as ChatbotConfig;
          setChatbot(chatbotData);
          
          // Check for vector store
          const vectorstoreExists = await checkVectorstoreExists(chatbotId);
          
          // Fallback: also check if documents exist in the chatbot data
          if (!vectorstoreExists && chatbotData.documents && chatbotData.documents.length > 0) {
            console.log('🔄 Fallback: Found documents in chatbot data, assuming vectorstore exists');
            setHasVectorstore(true);
            setVectorstoreDocCount(chatbotData.documents.length);
            // For legacy chatbots, generate the index name from chatbot ID
            const legacyIndexName = chatbotId.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 45);
            setVectorStoreIndexName(legacyIndexName);
            setVectorStoreName('Knowledge Base (Legacy)');
          }
        } else {
          setError('Chatbot not found');
        }
      } catch (err: any) {
        console.error('❌ Error fetching chatbot:', err);
        setError('Failed to load chatbot');
      } finally {
        setIsLoading(false);
      }
    };

    if (chatbotId && user) {
      fetchChatbot();
    }
  }, [chatbotId, user]);

  const deleteChatbot = async () => {
    setIsDeleting(true);
    setError(null);
    
    try {
      await deleteDoc(doc(db, 'chatbots', chatbotId));
      router.push("/dashboard/chatbots");
    } catch (err: any) {
      console.error("❌ Error deleting chatbot:", err);
      setError(`Failed to delete chatbot: ${err.message}`);
      setIsDeleting(false);
    }
  };

  const confirmDeleteChatbot = async (deleteVectorstore: boolean) => {
    if (!chatbot) return;
    
    setIsDeleting(true);
    setError(null);
    
    try {
      // Get Vercel project info from the chatbot data
      const vercelProjectId = chatbot.deployment?.vercelProjectId;
      const vercelProjectName = vercelProjectId || (chatbot.name ? 
        chatbot.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') : null);
      
      // Delete vector store if requested
      if (deleteVectorstore && hasVectorstore && vectorStoreIndexName) {
        console.log('🗑️ Deleting vector store:', vectorStoreIndexName);
        
        try {
          const response = await fetch('/api/vectorstore/index', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              indexName: vectorStoreIndexName,
              userId: user?.uid
            }),
          });
          
          if (response.ok) {
            console.log('✅ Vector store deleted successfully');
          } else {
            console.warn('⚠️ Failed to delete vector store, but continuing with chatbot deletion');
          }
        } catch (vectorError) {
          console.warn('⚠️ Error deleting vector store:', vectorError);
        }
      }
      
      // Delete from Vercel if we have project info
      if (vercelProjectId || vercelProjectName) {
        try {
          console.log('🚀 Deleting from Vercel:', vercelProjectId || vercelProjectName);
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
      await deleteDoc(doc(db, 'chatbots', chatbot.id));
      
      // Delete chatbot folder from Firebase Storage
      if (chatbot?.logoUrl) {
        try {
          await deleteChatbotFolder(user!.uid, chatbot.id);
          console.log('✅ Successfully deleted chatbot folder from Firebase Storage');
        } catch (logoError) {
          console.warn('⚠️ Error deleting logo folder:', logoError);
        }
      }
      
      router.push("/dashboard/chatbots");
    } catch (err: any) {
      console.error("❌ Error deleting chatbot:", err);
      setError(`Failed to delete chatbot: ${err.message}`);
      setIsDeleting(false);
    }
  };

  const handleDeployChatbot = async () => {
    if (!hasVectorstore) {
      setShowVectorStoreSelection(true);
    } else {
      await deployWithVectorStore(vectorStoreIndexName, vectorStoreName);
    }
  };

  const handleSelectExistingVectorStore = (indexName: string, displayName: string) => {
    setSelectedVectorStore({ indexName, displayName });
    setShowVectorStoreSelection(false);
    setShowVectorStoreNaming(true);
  };

  const handleCreateNewVectorStore = () => {
    setSelectedVectorStore(null);
    setShowVectorStoreSelection(false);
    setShowVectorStoreNaming(true);
  };

  const handleConfirmVectorStoreName = async (displayName: string, indexName: string, isExisting: boolean, embeddingModel: string) => {
    setShowVectorStoreNaming(false);
    
    if (isExisting && selectedVectorStore) {
      await deployWithVectorStore(selectedVectorStore.indexName, selectedVectorStore.displayName);
    } else {
      await deployWithNewVectorStore(displayName, indexName, embeddingModel);
    }
  };

  const deployWithVectorStore = async (indexName: string, displayName: string) => {
    if (!chatbot || !user) return;
    
    setIsDeploying(true);
    setDeploymentError(null);
    
    try {
      const response = await fetch('/api/vercel-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatbotId: chatbot.id,
          chatbotName: chatbot.name,
          userId: user.uid,
          vectorstore: { indexName, displayName }
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to deploy chatbot');
      }
      
      setChatbot({
        ...chatbot,
        status: 'active',
        deployment: {
          ...chatbot.deployment,
          deploymentUrl: data.url,
          status: 'deployed',
          deployedAt: new Date() as any,
        },
      });
      
      setSuccessMessage(`✅ Chatbot "${chatbot.name}" deployed successfully! Available at: ${data.url}`);
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      console.error('❌ Error deploying chatbot:', error);
      setDeploymentError(`Failed to deploy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const deployWithNewVectorStore = async (displayName: string, desiredIndexName?: string, embeddingModel?: string) => {
    if (!chatbot || !user) return;
    
    setIsDeploying(true);
    setDeploymentError(null);
    
    try {
      const response = await fetch('/api/vercel-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatbotId: chatbot.id,
          chatbotName: chatbot.name,
          userId: user.uid,
          vectorstore: null,
          desiredVectorstoreIndexName: desiredIndexName,
          embeddingModel: embeddingModel
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to deploy chatbot');
      }
      
      setChatbot({
        ...chatbot,
        status: 'active',
        deployment: {
          ...chatbot.deployment,
          deploymentUrl: data.url,
          status: 'deployed',
          deployedAt: new Date() as any,
        },
      });
      
      if (data.vectorstoreIndexName) {
        setVectorStoreIndexName(data.vectorstoreIndexName);
        setVectorStoreName(displayName);
        setHasVectorstore(true);
      }
      
      setSuccessMessage(`✅ Chatbot "${chatbot.name}" deployed successfully! Available at: ${data.url}`);
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      console.error('❌ Error deploying with new vector store:', error);
      setDeploymentError(`Failed to deploy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDeploying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 relative overflow-hidden">
        <div className="flex items-center justify-center h-screen">
          <Card>
            <CardContent className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading chatbot details...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 relative overflow-hidden">
        <div className="flex items-center justify-center h-screen">
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" />
      <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{ animationDelay: '2s' }} />
      
      {/* Dashboard Header */}
      <header className="relative z-10 backdrop-blur-sm bg-white/70 border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                    <div className="h-5 w-5 text-white">🤖</div>
                  </div>
                  <span className="font-bold text-xl text-gradient">Chat Factory</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <UserDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          {chatbot ? (
            <>
              {/* Success/Error Messages */}
              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded mb-4">
                  <p>{successMessage}</p>
                </div>
              )}
              
              {deploymentError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4">
                  <p>{deploymentError}</p>
                </div>
              )}
              
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4">
                  <p>{error}</p>
                </div>
              )}

              {/* Chatbot Header */}
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900">{chatbot.name}</h1>
                    <p className="text-gray-600 mt-1">{chatbot.description || 'No description available'}</p>
                  </div>
                  <div className="flex space-x-3">
                    <Button asChild>
                      <Link href={`/dashboard/chatbots/${chatbot.id}/edit`}>
                        Edit Chatbot
                      </Link>
                    </Button>
                    <Button 
                      onClick={handleDeployChatbot}
                      disabled={isDeploying}
                      className="bg-gradient-primary hover:opacity-90"
                    >
                      {isDeploying ? 'Deploying...' : 'Deploy'}
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => setShowDeleteDialog(true)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              </div>

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
                    onClick={() => setActiveTab('users')}
                    className={`${
                      activeTab === 'users'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                  >
                    Users
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
                          <span className={`h-3 w-3 rounded-full ${chatbot.deployment?.status === 'deployed' ? 'bg-green-500' : 'bg-yellow-500'} mr-2`}></span>
                          <div className="text-sm font-medium">{chatbot.status || 'Draft'}</div>
                        </div>
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
                  
                  {/* Deployment Info */}
                  {chatbot.deployment?.deploymentUrl && (
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle>Live Deployment</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="p-4 bg-green-50 rounded-lg">
                          <strong>Live URL:</strong>{' '}
                          <a 
                            href={chatbot.deployment.deploymentUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {chatbot.deployment.deploymentUrl}
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Chatbot Preview */}
                  <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-4">Chatbot Preview</h2>
                  <Card className="max-w-md mx-auto">
                    <CardContent className="p-6">
                      <div className="border rounded-lg bg-gray-50 p-4 mb-4 h-60 overflow-y-auto">
                        {/* Simulated chat messages */}
                        <div className="flex items-start space-x-2 mb-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                            {chatbot.logoUrl ? (
                              <img
                                src={chatbot.logoUrl}
                                alt={`${chatbot.name} logo`}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <span style={{ color: chatbot.appearance?.primaryColor || '#3b82f6' }} className="font-bold text-sm">{chatbot.name.charAt(0)}</span>
                            )}
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
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                            {chatbot.logoUrl ? (
                              <img
                                src={chatbot.logoUrl}
                                alt={`${chatbot.name} logo`}
                                className="h-8 w-8 rounded-full object-cover"
                              />
                            ) : (
                              <span style={{ color: chatbot.appearance?.primaryColor || '#3b82f6' }} className="font-bold text-sm">{chatbot.name.charAt(0)}</span>
                            )}
                          </div>
                          <div className="bg-white rounded-lg p-2 shadow-sm max-w-xs">
                            <p className="text-sm">
                              Great question! Let me walk you through the key steps based on our documentation...
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'documents' && (
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold text-gray-900">Documents & Knowledge Base</h2>
                    <div className="text-sm text-gray-600">
                      {vectorstoreDocCount} documents uploaded
                    </div>
                  </div>

                  {/* Upload Section */}
                  <InlineDocumentUpload 
                    chatbotId={chatbotId}
                    onUploadComplete={() => {
                      // Refresh the document list and update document count
                      setRefreshKey(prev => prev + 1);
                      // Update the document count (increment by 1 for each successful upload)
                      setVectorstoreDocCount(prev => prev + 1);
                    }}
                  />

                  {/* Knowledge Base Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Total Documents</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-blue-600">{vectorstoreDocCount}</div>
                        <p className="text-xs text-gray-500 mt-1">Files processed</p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Vector Store</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm font-semibold text-gray-900">{vectorStoreName || 'Knowledge Base'}</div>
                        <p className="text-xs text-gray-500 mt-1">Index: {vectorStoreIndexName}</p>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-500">Status</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center">
                          <span className={`h-3 w-3 rounded-full ${hasVectorstore ? 'bg-green-500' : 'bg-yellow-500'} mr-2`}></span>
                          <div className="text-sm font-medium">
                            {hasVectorstore ? 'Active' : 'Setup Required'}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {hasVectorstore ? 'Ready for queries' : 'Upload documents to activate'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Uploaded Documents */}
                  <UserPDFManager 
                    key={refreshKey}
                    chatbotId={chatbotId}
                    showChatbotFilter={false}
                  />
                </div>
              )}

              {activeTab === 'users' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">User Management</h2>
                  
                  <ChatbotUserManagement
                    chatbot={chatbot}
                    onUpdate={() => {
                      // Refresh chatbot data when users are updated
                      window.location.reload();
                    }}
                  />
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
                              {chatbot.aiConfig?.temperature || 'Not configured'}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium mb-2">Context Window</h4>
                            <p className="text-sm bg-gray-50 p-2 rounded border">
                              {chatbot.aiConfig?.contextWindow || 'Not configured'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Vector Store Configuration */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Vector Store Configuration</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-sm font-medium mb-2">Vector Store Name</h4>
                            <p className="text-sm bg-gray-50 p-2 rounded border">
                              {vectorStoreName || 'Not configured'}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium mb-2">Index Name</h4>
                            <p className="text-sm bg-gray-50 p-2 rounded border">
                              {vectorStoreIndexName || 'Not configured'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Appearance Settings */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Appearance</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-sm font-medium mb-2">Primary Color</h4>
                            <div className="flex items-center space-x-2">
                              <div 
                                className="w-6 h-6 rounded border"
                                style={{ backgroundColor: chatbot.appearance?.primaryColor || '#3b82f6' }}
                              ></div>
                              <p className="text-sm">
                                {chatbot.appearance?.primaryColor || '#3b82f6'}
                              </p>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium mb-2">Bubble Style</h4>
                            <p className="text-sm bg-gray-50 p-2 rounded border">
                              {chatbot.appearance?.bubbleStyle || 'Not configured'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {activeTab === 'analytics' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Analytics</h2>
                  <Card>
                    <CardContent className="p-6">
                      <p className="text-gray-500 text-center">Analytics dashboard coming soon...</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          ) : (
            <div>Chatbot not found</div>
          )}
        </div>
      </main>
      
      {/* Dialogs */}
      {showDeleteDialog && chatbot && (
        <ChatbotDeletionDialog
          chatbotName={chatbot.name}
          hasVectorstore={hasVectorstore}
          vectorStoreName={vectorStoreName}
          onConfirm={confirmDeleteChatbot}
          onCancel={() => setShowDeleteDialog(false)}
          isDeleting={isDeleting}
        />
      )}

      <VectorStoreSelectionDialog
        isOpen={showVectorStoreSelection}
        onSelectExisting={handleSelectExistingVectorStore}
        onCreateNew={handleCreateNewVectorStore}
        onCancel={() => setShowVectorStoreSelection(false)}
        userId={user?.uid || ''}
      />

      <VectorStoreNameDialog
        isOpen={showVectorStoreNaming}
        onConfirm={handleConfirmVectorStoreName}
        onCancel={() => setShowVectorStoreNaming(false)}
        userId={user?.uid || ''}
        embeddingModel={chatbot?.aiConfig?.embeddingModel || 'text-embedding-3-small'}
        isValidating={isDeploying}
      />
    </div>
  );
}
