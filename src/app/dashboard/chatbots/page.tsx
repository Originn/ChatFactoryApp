'use client';

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import UserDropdown from "@/components/dashboard/UserDropdown";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, orderBy, doc, deleteDoc } from "firebase/firestore";
import { deleteChatbotFolder } from "@/lib/utils/logoUpload";
import { ClientFirebaseProjectService } from '@/services/clientFirebaseProjectService';
import { ChatbotDeletionDialog } from '@/components/dialogs/ChatbotDeletionDialog';
import { 
  Bot, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Globe, 
  MessageCircle, 
  Activity, 
  Eye,
  Settings,
  Sparkles,
  ArrowUpRight,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react";

// Define the Chatbot type for TypeScript
interface Chatbot {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: any; // Using 'any' for Firestore Timestamp
  vercelProjectId?: string;
  logoUrl?: string;
  stats?: {
    queries: number;
    successRate: number;
  };
  vectorstore?: {
    indexName: string;
    displayName: string;
  };
  documents?: any[];
  userId?: string;
}

export default function ChatbotsPage() {
  const { user } = useAuth();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // State for deletion dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [chatbotToDelete, setChatbotToDelete] = useState<Chatbot | null>(null);
  const [hasVectorstore, setHasVectorstore] = useState(false);
  const [vectorStoreName, setVectorStoreName] = useState<string>('');
  const [vectorStoreIndexName, setVectorStoreIndexName] = useState<string>('');
  
  // Function to fetch chatbots
  const fetchChatbots = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    try {
      // Create a query against the chatbots collection
      // Now using the Firebase index for server-side sorting
      const q = query(
        collection(db, "chatbots"), 
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      
      const querySnapshot = await getDocs(q);
      const chatbotsList: Chatbot[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<Chatbot, 'id'>;
        chatbotsList.push({
          id: doc.id,
          ...data
        });
      });
      
      setChatbots(chatbotsList);
    } catch (err: any) {
      console.error("Error fetching chatbots:", err);
      setError(err.message || "Failed to load chatbots");
    } finally {
      setIsLoading(false);
    }
  }, [user]);
  
  // Check if vectorstore exists for a chatbot
  const checkVectorstoreExists = (chatbot: Chatbot): { hasVectorstore: boolean; indexName: string; displayName: string } => {
    // Check for explicit vectorstore configuration
    if (chatbot.vectorstore?.indexName) {
      return {
        hasVectorstore: true,
        indexName: chatbot.vectorstore.indexName,
        displayName: chatbot.vectorstore.displayName || 'Knowledge Base'
      };
    }
    
    // Fallback: check if documents exist (legacy chatbots)
    if (chatbot.documents && chatbot.documents.length > 0) {
      const legacyIndexName = chatbot.id.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 45);
      return {
        hasVectorstore: true,
        indexName: legacyIndexName,
        displayName: 'Knowledge Base (Legacy)'
      };
    }
    
    return {
      hasVectorstore: false,
      indexName: '',
      displayName: ''
    };
  };
  
  // Show delete dialog
  const showDeleteChatbotDialog = (chatbot: Chatbot) => {
    const vectorstoreInfo = checkVectorstoreExists(chatbot);
    
    setChatbotToDelete(chatbot);
    setHasVectorstore(vectorstoreInfo.hasVectorstore);
    setVectorStoreIndexName(vectorstoreInfo.indexName);
    setVectorStoreName(vectorstoreInfo.displayName);
    setShowDeleteDialog(true);
  };
  
  // Delete chatbot function (called from dialog)
  const handleDeleteChatbot = async (deleteVectorstore: boolean) => {
    if (!chatbotToDelete) return;
    
    const id = chatbotToDelete.id;
    
    setDeletingId(id);
    let firebaseDeleteResult: any = null; // Declare at function scope
    
    try {
      // First, get the chatbot data to retrieve Vercel project info and user info
      const chatbotDoc = await getDocs(query(
        collection(db, "chatbots"), 
        where("__name__", "==", id)
      ));
      
      let vercelProjectId = null;
      let vercelProjectName = null;
      let chatbotUserId = null;
      
      if (!chatbotDoc.empty) {
        const chatbotData = chatbotDoc.docs[0].data();
        vercelProjectId = chatbotData.vercelProjectId;
        chatbotUserId = chatbotData.userId;
        
        // Fallback to project name if no projectId stored
        if (!vercelProjectId && chatbotData.name) {
          vercelProjectName = (chatbotData.name || `chatbot-${id}`)
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-');
        }
      }
      
      // Delete vectorstore if requested
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
      
      // Delete entire chatbot folder from Firebase Storage (includes logos and any other files)
      if (chatbotUserId) {
        try {
          console.log('Deleting chatbot folder from Firebase Storage for user:', chatbotUserId, 'chatbot:', id);
          await deleteChatbotFolder(chatbotUserId, id);
          console.log('✅ Successfully deleted chatbot folder from Firebase Storage');
        } catch (storageError) {
          console.error('❌ Error deleting chatbot folder:', storageError);
          // Continue with deletion even if storage deletion fails
        }
      } else {
        console.log('ℹ️ No user ID found, skipping storage deletion');
      }
      
      // Handle Firebase project deletion or cleanup
      try {
        // Check if we're using reusable Firebase project mode
        const useReusableFirebase = process.env.NEXT_PUBLIC_USE_REUSABLE_FIREBASE_PROJECT === 'true';
        
        if (useReusableFirebase) {
          console.log('🧹 Cleaning up reusable Firebase project data for chatbot:', id);
          
          // Call the cleanup API route instead of importing the service directly
          try {
            const cleanupResponse = await fetch('/api/cleanup-reusable-firebase', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                chatbotId: id,
                userId: chatbotUserId || user.uid
              }),
            });

            const cleanupResult = await cleanupResponse.json();
            
            if (cleanupResult.success) {
              console.log('✅ Reusable Firebase project cleanup completed:', cleanupResult.message);
              
              // Show success notification
              const successDiv = document.createElement('div');
              successDiv.style.cssText = `
                position: fixed; top: 20px; right: 20px; z-index: 9999;
                background: #10b981; color: white; padding: 15px 20px;
                border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                font-weight: 500; max-width: 400px;
              `;
              successDiv.textContent = '✅ Chatbot data cleaned from reusable Firebase project!';
              document.body.appendChild(successDiv);
              
              // Remove notification after 5 seconds
              setTimeout(() => successDiv.remove(), 5000);
              
            } else {
              console.warn('⚠️ Reusable Firebase project cleanup had issues:', cleanupResult.message);
              
              alert(
                `⚠️ Firebase Data Cleanup Warning\n\n` +
                `Some chatbot data may not have been fully cleaned from the reusable Firebase project.\n\n` +
                `Details: ${cleanupResult.message}\n\n` +
                `You may need to manually clean up remaining data from the Firebase Console.`
              );
            }
          } catch (cleanupError: any) {
            console.error('❌ Error calling cleanup API:', cleanupError);
            alert(
              `❌ Cleanup API Error\n\n` +
              `Failed to call the cleanup service. The chatbot has been deleted from this app, but you may need to manually clean up the Firebase project data.\n\n` +
              `Error: ${cleanupError.message}`
            );
          }
          
        } else {
          console.log('🔥 Attempting automated Firebase project deletion for chatbot:', id);
          
          if (!user) {
            console.error('❌ No authenticated user');
            throw new Error('No authenticated user');
          }

          // Get auth token from Firebase user
          const token = await user.getIdToken();
          firebaseDeleteResult = await ClientFirebaseProjectService.deleteProjectForChatbot(id, token);
          
          if (firebaseDeleteResult.success) {
            if (firebaseDeleteResult.error) {
              // Partial success or warning - show detailed instructions
              console.warn('⚠️ Firebase project deletion completed with warnings:', firebaseDeleteResult.error);
              
              // Show a notification that includes troubleshooting info
              if (firebaseDeleteResult.error.includes('TROUBLESHOOTING AUTOMATED DELETION')) {
                // This is an automated deletion failure - show technical details
                const shouldShowDetails = confirm(
                  `⚠️ AUTOMATED DELETION FAILED\n\n` +
                  `Your chatbot has been deleted from this app, but the Firebase project deletion failed.\n\n` +
                  `This typically happens due to authentication or permission issues.\n\n` +
                  `Click OK to see technical troubleshooting details, or Cancel to skip.`
                );
                
                if (shouldShowDetails) {
                  // Show detailed technical information in a new window or alert
                  const detailsWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
                  if (detailsWindow) {
                    detailsWindow.document.write(`
                      <html>
                        <head><title>Firebase Project Deletion Troubleshooting</title></head>
                        <body style="font-family: monospace; padding: 20px; white-space: pre-wrap;">
                          ${firebaseDeleteResult.error.replace(/\n/g, '<br>')}
                        </body>
                      </html>
                    `);
                    detailsWindow.document.close();
                  } else {
                    // Fallback to console log if popup blocked
                    console.log('🔧 Troubleshooting details:', firebaseDeleteResult.error);
                    alert('Troubleshooting details have been logged to the console (F12 → Console)');
                  }
                }
              } else {
                // Other types of warnings
                alert(`⚠️ Firebase Project Deletion Warning\n\n${firebaseDeleteResult.error}`);
              }
            } else {
              console.log('✅ Successfully deleted Firebase project automatically');
              
              // Show success notification
              const successDiv = document.createElement('div');
              successDiv.style.cssText = `
                position: fixed; top: 20px; right: 20px; z-index: 9999;
                background: #10b981; color: white; padding: 15px 20px;
                border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                font-weight: 500; max-width: 400px;
              `;
              successDiv.textContent = '✅ Chatbot and Firebase project deleted successfully!';
              document.body.appendChild(successDiv);
              
              // Remove notification after 5 seconds
              setTimeout(() => successDiv.remove(), 5000);
            }
          } else {
            console.error('❌ Failed to delete Firebase project:', firebaseDeleteResult.error);
            
            // Show user-friendly error with actionable steps
            alert(
              `❌ Automated Firebase Project Deletion Failed\n\n` +
              `Your chatbot has been deleted from this app, but we couldn't automatically delete the Firebase project.\n\n` +
              `Common causes:\n` +
              `• Authentication not configured\n` +
              `• Insufficient permissions\n` +
              `• Project has active services\n\n` +
              `To manually delete the project:\n` +
              `1. Go to: https://console.firebase.google.com\n` +
              `2. Select your project\n` +
              `3. Go to Settings → General\n` +
              `4. Click "Delete project"\n\n` +
              `Technical details logged to console.`
            );
            
            console.error('🔧 Full error details:', firebaseDeleteResult.error);
          }
        }
      } catch (firebaseError) {
        console.error('❌ Error during Firebase operations:', firebaseError);
        
        alert(
          `❌ Firebase Operation Error\n\n` +
          `Your chatbot has been deleted from this app, but there was an error during Firebase operations.\n\n` +
          `Please check the Firebase Console manually if needed.\n\n` +
          `Error details have been logged to the console.`
        );
        
        console.error('🔧 Firebase operation error details:', firebaseError);
      }
      
      // Only delete from Firestore if Firebase project deletion didn't handle it
      if (!firebaseDeleteResult?.success) {
        try {
          // Delete the document from Firestore
          await deleteDoc(doc(db, "chatbots", id));
          console.log('✅ Deleted chatbot document from Firestore');
        } catch (firestoreError: any) {
          console.warn('⚠️ Firestore deletion failed (document might already be deleted):', firestoreError.message);
          // Don't throw error - chatbot might already be deleted by Firebase project cleanup
        }
      } else {
        console.log('✅ Chatbot document already deleted by Firebase project cleanup');
      }
      
      // Update local state
      setChatbots(chatbots.filter(chatbot => chatbot.id !== id));
      
      console.log('✅ Chatbot deleted successfully from Vercel, Storage, and Firestore');
    } catch (err: any) {
      console.error("Error deleting chatbot:", err);
      setError(`Failed to delete chatbot: ${err.message}`);
    } finally {
      setDeletingId(null);
      setShowDeleteDialog(false);
      setChatbotToDelete(null);
    }
  };
  
  useEffect(() => {
    fetchChatbots();
  }, [fetchChatbots]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-25 via-white to-purple-25 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" />
      <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{ animationDelay: '2s' }} />
      
      {/* Dashboard Header */}
      <header className="relative z-50 backdrop-blur-sm bg-white/70 border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-bold text-xl text-gradient">Chat Factory</span>
                </div>
              </div>
              <nav className="hidden sm:ml-8 sm:flex sm:space-x-8">
                <Link
                  href="/dashboard"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/chatbots"
                  className="border-purple-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Chatbots
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors"
                >
                  Settings
                </Link>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                asChild
                variant="gradient"
                className="shadow-lg shadow-purple-500/25"
              >
                <Link href="/dashboard/chatbots/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Chatbot
                </Link>
              </Button>
              <UserDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Chatbots Content */}
      <main className="relative max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          {/* Header Section */}
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  Your AI Chatbots
                </h1>
                <p className="text-gray-600">
                  Create, manage, and deploy intelligent chatbots for your business.
                </p>
              </div>
              <div className="hidden md:flex items-center space-x-3">
                <Badge variant="outline" className="bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 border border-purple-200/50">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {chatbots.length} Active
                </Badge>
              </div>
            </div>
            
            {/* Search and Filter Bar */}
            <Card variant="elevated" className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search chatbots..."
                      className="pl-10 border-gray-200 focus:border-purple-300 focus:ring-purple-200"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="border-gray-200 hover:bg-gray-50">
                      <Filter className="h-4 w-4 mr-1" />
                      Filter
                    </Button>
                    <Button variant="blue-outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      New Chatbot
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-slide-up" style={{ animationDelay: '0.15s' }}>
            <Card variant="elevated" hover="lift" className="group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Chatbots</p>
                    <p className="text-2xl font-bold text-gray-900">{chatbots.length}</p>
                  </div>
                  <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Bot className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card variant="elevated" hover="lift" className="group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active</p>
                    <p className="text-2xl font-bold text-green-600">
                      {chatbots.filter(c => c.status === 'active').length}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CheckCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card variant="elevated" hover="lift" className="group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Queries</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {chatbots.reduce((sum, bot) => sum + (bot.stats?.queries || 0), 0)}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card variant="elevated" hover="lift" className="group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Avg Success Rate</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {chatbots.length > 0 
                        ? Math.round(chatbots.reduce((sum, bot) => sum + (bot.stats?.successRate || 0), 0) / chatbots.length)
                        : 0}%
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Activity className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Content */}
          {isLoading ? (
            // Loading state
            <Card variant="elevated" className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <CardContent className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading your chatbots...</p>
              </CardContent>
            </Card>
          ) : error ? (
            // Error state
            <Card variant="elevated" className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <CardContent className="p-8">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-red-800">Error Loading Chatbots</h3>
                    <p className="mt-1 text-sm text-red-600">{error}</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-3" 
                      onClick={() => window.location.reload()}
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : chatbots.length === 0 ? (
            // Empty state
            <Card variant="glow" className="animate-pulse-soft animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <CardContent className="p-16 text-center">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-3xl flex items-center justify-center mb-8">
                  <Bot className="h-10 w-10 text-purple-600" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">No chatbots yet</h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto text-lg">
                  Ready to create your first AI-powered chatbot? It only takes a few minutes to get started.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    asChild
                    variant="gradient"
                    size="lg"
                    className="shadow-lg shadow-purple-500/25"
                  >
                    <Link href="/dashboard/chatbots/new">
                      <Plus className="h-5 w-5 mr-2" />
                      Create Your First Chatbot
                    </Link>
                  </Button>
                  <Button 
                    asChild
                    variant="outline"
                    size="lg"
                    className="border-purple-200 hover:bg-purple-50"
                  >
                    <Link href="/dashboard">
                      <ArrowUpRight className="h-4 w-4 mr-2" />
                      Back to Dashboard
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            // Modern Grid Layout for Chatbots
            <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {chatbots.map((chatbot, index) => {
                  const animationDelay = `${0.1 + (index * 0.05)}s`;
                  
                  return (
                    <Card 
                      key={chatbot.id} 
                      variant="elevated" 
                      hover="lift" 
                      className="group animate-slide-up overflow-hidden"
                      style={{ animationDelay }}
                    >
                      <CardHeader className="pb-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center overflow-hidden shadow-lg group-hover:scale-110 transition-transform">
                                {chatbot.logoUrl ? (
                                  <img
                                    src={chatbot.logoUrl}
                                    alt={`${chatbot.name} logo`}
                                    className="h-12 w-12 rounded-xl object-cover"
                                  />
                                ) : (
                                  <span className="text-white font-bold text-lg">{chatbot.name.charAt(0)}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 truncate group-hover:text-purple-700 transition-colors">
                                {chatbot.name}
                              </h3>
                              <Badge 
                                variant="outline"
                                className={`mt-1 ${
                                  chatbot.status === 'active'
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : chatbot.status === 'preview'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : chatbot.status === 'draft'
                                    ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    : 'bg-gray-50 text-gray-700 border-gray-200'
                                }`}
                              >
                                <div className={`h-2 w-2 rounded-full mr-1.5 ${
                                  chatbot.status === 'active' ? 'bg-green-500' :
                                  chatbot.status === 'preview' ? 'bg-blue-500' :
                                  chatbot.status === 'draft' ? 'bg-yellow-500' : 'bg-gray-500'
                                }`} />
                                {chatbot.status === 'active' ? 'Active' :
                                 chatbot.status === 'preview' ? 'Preview' :
                                 chatbot.status === 'draft' ? 'Draft' : chatbot.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <CardDescription className="text-sm text-gray-600 line-clamp-2">
                          {chatbot.description || 'No description provided'}
                        </CardDescription>
                      </CardHeader>
                      
                      <CardContent className="pt-0">
                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                            <div className="flex items-center justify-center mb-1">
                              <MessageCircle className="h-4 w-4 text-blue-600 mr-1" />
                              <span className="text-lg font-bold text-blue-900">{chatbot.stats?.queries || 0}</span>
                            </div>
                            <p className="text-xs text-blue-700">Queries</p>
                          </div>
                          <div className="text-center p-3 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                            <div className="flex items-center justify-center mb-1">
                              <Activity className="h-4 w-4 text-green-600 mr-1" />
                              <span className="text-lg font-bold text-green-900">{chatbot.stats?.successRate || 0}%</span>
                            </div>
                            <p className="text-xs text-green-700">Success Rate</p>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex space-x-2">
                          <Button 
                            asChild
                            variant="outline" 
                            size="sm" 
                            className="flex-1 group-hover:border-blue-300 group-hover:bg-blue-50 transition-colors"
                          >
                            <Link href={`/dashboard/chatbots/${chatbot.id}`}>
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Link>
                          </Button>
                          <Button 
                            asChild
                            variant="outline" 
                            size="sm" 
                            className="flex-1 group-hover:border-purple-300 group-hover:bg-purple-50 transition-colors"
                          >
                            <Link href={`/dashboard/chatbots/${chatbot.id}/edit`}>
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Link>
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="group-hover:border-red-300 group-hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors"
                            onClick={() => showDeleteChatbotDialog(chatbot)}
                            disabled={deletingId === chatbot.id}
                          >
                            {deletingId === chatbot.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-red-500" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
      
      {/* Deletion Dialog */}
      {showDeleteDialog && chatbotToDelete && (
        <ChatbotDeletionDialog
          chatbotName={chatbotToDelete.name}
          hasVectorstore={hasVectorstore}
          vectorStoreName={vectorStoreName}
          documentsCount={chatbotToDelete.documents?.length || 0}
          onConfirm={handleDeleteChatbot}
          onCancel={() => setShowDeleteDialog(false)}
          isDeleting={deletingId === chatbotToDelete.id}
        />
      )}
    </div>
  );
}
