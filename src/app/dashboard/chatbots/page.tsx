'use client';

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import UserDropdown from "@/components/dashboard/UserDropdown";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/shared/Header";
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
  AlertCircle,
} from "lucide-react";

// Define the Chatbot type for TypeScript
interface Chatbot {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: any; // Using 'any' for Firestore Timestamp
  vercelProjectId?: string;
  firebaseProjectId?: string;
  logoUrl?: string;
  stats?: {
    queries: number;
    successRate: number;
  };
  vectorstore?: {
    indexName: string;
    displayName: string;
  };
  deployment?: {
    status: 'deployed' | 'deploying' | string;
    deploymentUrl?: string;
    deployedAt?: any;
  };
  documents?: any[];
  userId?: string;
}

export default function ChatbotsPage() {
  const { user } = useAuth();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for deletion dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [chatbotToDelete, setChatbotToDelete] = useState<Chatbot | null>(null);
  const [hasVectorstore, setHasVectorstore] = useState(false);
  const [vectorStoreName, setVectorStoreName] = useState<string>('');
  const [vectorStoreIndexName, setVectorStoreIndexName] = useState<string>('');
  const [vectorCount, setVectorCount] = useState<number>(0);
  const [isLoadingVectorCount, setIsLoadingVectorCount] = useState(false);
  const [hasAuraDB, setHasAuraDB] = useState(false);
  const [auraDBInstanceName, setAuraDBInstanceName] = useState<string>('');

  // Background deletion notification
  const [showDeletionNotification, setShowDeletionNotification] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState<string>('');
  const [deletingChatbotId, setDeletingChatbotId] = useState<string | null>(null);

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

  // Check if AuraDB exists for this chatbot (synchronous check using existing data)
  const checkAuraDBExists = (chatbot: Chatbot): { hasAuraDB: boolean; instanceName: string } => {
    // For now, assume AuraDB exists if chatbot has firebaseProjectId
    // In a real implementation, you might want to fetch the Firebase project data
    if (chatbot.firebaseProjectId) {
      return {
        hasAuraDB: true,
        instanceName: `chatbot-${chatbot.id}`
      };
    }

    return {
      hasAuraDB: false,
      instanceName: ''
    };
  };

  // Show delete dialog
  const showDeleteChatbotDialog = async (chatbot: Chatbot) => {
    const vectorstoreInfo = checkVectorstoreExists(chatbot);
    const auraDBInfo = checkAuraDBExists(chatbot);

    setChatbotToDelete(chatbot);
    setHasVectorstore(vectorstoreInfo.hasVectorstore);
    setVectorStoreIndexName(vectorstoreInfo.indexName);
    setVectorStoreName(vectorstoreInfo.displayName);
    setVectorCount(0);
    setIsLoadingVectorCount(vectorstoreInfo.hasVectorstore);
    setHasAuraDB(auraDBInfo.hasAuraDB);
    setAuraDBInstanceName(auraDBInfo.instanceName);
    setShowDeleteDialog(true);

    // Fetch real vector count if vectorstore exists
    if (vectorstoreInfo.hasVectorstore && vectorstoreInfo.indexName && user) {
      try {
        console.log('📊 Fetching vector count for index:', vectorstoreInfo.indexName);
        
        const response = await fetch('/api/vectorstore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'stats',
            indexName: vectorstoreInfo.indexName,
            userId: user.uid
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.stats) {
            // Extract vector count from stats - check multiple possible locations
            let count = 0;
            
            if (result.stats.totalRecordCount) {
              count = result.stats.totalRecordCount;
            } else if (result.stats.namespaces) {
              // Sum up records from all namespaces
              count = Object.values(result.stats.namespaces).reduce((total, namespace: any) => {
                return total + (namespace.recordCount || namespace.vectorCount || 0);
              }, 0) as number;
            }
            
            console.log('✅ Vector count fetched:', count);
            setVectorCount(count);
          }
        } else {
          console.warn('⚠️ Failed to fetch vector count');
        }
      } catch (error) {
        console.error('❌ Error fetching vector count:', error);
      } finally {
        setIsLoadingVectorCount(false);
      }
    }
  };
  
  // Delete chatbot function (called from dialog)
  const handleDeleteChatbot = async (deleteVectorstore: boolean, deleteAuraDB: boolean) => {
    if (!chatbotToDelete) return;

    const id = chatbotToDelete.id;
    const chatbotName = chatbotToDelete.name;

    // Close dialog immediately
    setShowDeleteDialog(false);
    setChatbotToDelete(null);

    // Mark this chatbot as being deleted
    setDeletingChatbotId(id);

    // Show background deletion notification
    setShowDeletionNotification(true);
    setDeletionProgress(`Deleting "${chatbotName}"...`);

    // Perform deletion in the background
    (async () => {
      let firebaseDeleteResult: any = null;

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
          setDeletionProgress('Deleting vector store...');
          console.log('🗑️ Deleting vector store:', vectorStoreIndexName);

          try {
            const response = await fetch('/api/vectorstore', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'delete',
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

        // Delete AuraDB instance if requested
        if (deleteAuraDB && hasAuraDB) {
          setDeletionProgress('Deleting AuraDB instance...');
          console.log('🗑️ Deleting AuraDB instance...');

          try {
            const response = await fetch('/api/chatbot-deletion', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chatbotId: id,
                userId: user?.uid,
                deleteVectorstore: false, // We already handled this above
                deleteAuraDB: true
              }),
            });

            if (response.ok) {
              const result = await response.json();
              console.log('✅ AuraDB instance deleted successfully:', result);
            } else {
              const error = await response.json();
              console.warn('⚠️ Failed to delete AuraDB instance:', error.message);
            }
          } catch (auraError) {
            console.warn('⚠️ Error deleting AuraDB instance:', auraError);
          }
        }
      
        // Delete Vercel project via backend API
        setDeletionProgress('Deleting Vercel deployment...');

        if (vercelProjectId || vercelProjectName) {
          try {
            console.log(`🎯 Deleting Vercel project: ${vercelProjectId || vercelProjectName}`);

            const vercelDeleteResponse = await fetch('/api/vercel-delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                projectId: vercelProjectId,
                projectName: vercelProjectName
              }),
            });

            if (vercelDeleteResponse.ok) {
              console.log('✅ Vercel project deleted successfully');
            } else {
              const error = await vercelDeleteResponse.json();
              console.warn('⚠️ Vercel deletion failed:', error.message);
            }
          } catch (vercelError) {
            console.error('❌ Error deleting Vercel project:', vercelError);
          }
        } else {
          console.log('📭 No Vercel project info - skipping Vercel deletion');
        }

        setDeletionProgress('Cleaning up storage files...');

        // Delete chatbot folder from Firebase Storage (includes logos and any other files)
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
        setDeletionProgress('Cleaning up Firebase project...');

        try {
          // Check if we're using reusable Firebase project mode
          const useReusableFirebase = process.env.NEXT_PUBLIC_USE_REUSABLE_FIREBASE_PROJECT === 'true';

          if (useReusableFirebase) {
            console.log('🧹 Using integrated cleanup for reusable Firebase project:', id);

            // Use the integrated chatbots DELETE endpoint (handles cleanup automatically)
            try {
              if (!user) {
                throw new Error('No authenticated user for cleanup');
              }

              const token = await user.getIdToken();
              const cleanupResponse = await fetch('/api/chatbots', {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  chatbotId: id,
                  userId: chatbotUserId || user.uid,
                  deleteVectorstore: deleteVectorstore,
                  deleteFirebaseProject: true // This triggers automatic cleanup + project recycling
                }),
              });

              if (!cleanupResponse.ok) {
                throw new Error(`Cleanup API returned ${cleanupResponse.status}`);
              }

              const cleanupResult = await cleanupResponse.json();

              if (cleanupResult.success) {
                console.log('✅ Integrated cleanup completed:', cleanupResult.message);
                firebaseDeleteResult = { success: true, automated: true };
              } else {
                console.warn('⚠️ Integrated cleanup had issues:', cleanupResult.message);
                firebaseDeleteResult = { success: false, error: cleanupResult.message };
              }
            } catch (cleanupError: any) {
              console.error('❌ Error calling integrated cleanup:', cleanupError);
              firebaseDeleteResult = { success: false, error: cleanupError.message };
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
                console.warn('⚠️ Firebase project deletion completed with warnings:', firebaseDeleteResult.error);
              } else {
                console.log('✅ Successfully deleted Firebase project automatically');
              }
            } else {
              console.error('❌ Failed to delete Firebase project:', firebaseDeleteResult.error);
            }
          }
        } catch (firebaseError: any) {
          console.error('❌ Error with Firebase project cleanup:', firebaseError);
          firebaseDeleteResult = { success: false, error: firebaseError.message };
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
        setChatbots(prev => prev.filter(chatbot => chatbot.id !== id));

        console.log('✅ Chatbot deleted successfully from all services');

        // Success!
        setDeletionProgress(`"${chatbotName}" deleted successfully!`);

        // Hide notification and clear deleting state after showing success
        setTimeout(() => {
          setShowDeletionNotification(false);
          setDeletingChatbotId(null);
        }, 3000);

      } catch (err: any) {
        console.error("Error deleting chatbot:", err);
        setDeletionProgress(`Failed to delete chatbot: ${err.message}`);

        // Hide notification and clear deleting state after error
        setTimeout(() => {
          setShowDeletionNotification(false);
          setDeletingChatbotId(null);
        }, 5000);
      }
    })();
  };
  
  useEffect(() => {
    fetchChatbots();
  }, [fetchChatbots]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background dark:from-background dark:via-muted/20 dark:to-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" />
      <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{ animationDelay: '2s' }} />
      
      {/* Dashboard Header */}
      <Header variant="dashboard" showDashboardNav={true} showCreateButton={true} currentPage="chatbots" />

      {/* Chatbots Content */}
      <main className="relative max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          {/* Header Section */}
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  Your AI Chatbots
                </h1>
                <p className="text-muted-foreground">
                  Create, manage, and deploy intelligent chatbots for your business.
                </p>
              </div>
              <div className="hidden md:flex items-center space-x-3">
                <Badge variant="outline" className="bg-white dark:bg-gray-800 text-purple-900 dark:text-purple-200 border-2 border-purple-400 dark:border-purple-500 shadow-sm font-semibold">
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
                      className="pl-10 border-border focus:border-purple-300 focus:ring-purple-200"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="border-border hover:bg-muted/50 h-8 px-2 sm:h-9 sm:px-3">
                      <Filter className="h-4 w-4 mr-0.5 sm:mr-1" />
                      Filter
                    </Button>
                    <Button variant="blue-outline" size="sm" className="h-8 px-2 sm:h-9 sm:px-3">
                      <Plus className="h-4 w-4 mr-0.5 sm:mr-1" />
                      <span className="hidden sm:inline">New Chatbot</span>
                      <span className="sm:hidden">New</span>
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
                    <p className="text-sm text-muted-foreground">Total Chatbots</p>
                    <p className="text-2xl font-bold text-foreground">{chatbots.length}</p>
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
                    <p className="text-sm text-muted-foreground">Active</p>
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">
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
                    <p className="text-sm text-muted-foreground">Total Queries</p>
                    <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
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
                    <p className="text-sm text-muted-foreground">Avg Success Rate</p>
                    <p className="text-2xl font-bold text-orange-700 dark:text-orange-400">
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
                <p className="text-muted-foreground">Loading your chatbots...</p>
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
                  <Bot className="h-10 w-10 text-purple-700 dark:text-purple-400" />
                </div>
                <h3 className="text-2xl font-semibold text-foreground mb-4">No chatbots yet</h3>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto text-lg">
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
                      className={`group animate-slide-up overflow-hidden transition-opacity ${
                        deletingChatbotId === chatbot.id ? 'opacity-60' : ''
                      }`}
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
                              <h3 className="font-semibold text-foreground truncate group-hover:text-purple-700 transition-colors">
                                {chatbot.name}
                              </h3>
                              <Badge
                                variant="outline"
                                className={`mt-1 ${
                                  deletingChatbotId === chatbot.id
                                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/50'
                                    : chatbot.deployment?.status === 'deployed'
                                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/50'
                                    : chatbot.deployment?.status === 'deploying'
                                    ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700/50'
                                    : chatbot.status === 'active'
                                    ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/50'
                                    : chatbot.status === 'preview'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/50'
                                    : chatbot.status === 'draft'
                                    ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700/50'
                                    : 'bg-gray-50 text-foreground border-border dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-600'
                                }`}
                              >
                                {deletingChatbotId === chatbot.id ? (
                                  <>
                                    <div className="animate-spin rounded-full h-2 w-2 border-t border-b border-red-500 mr-1.5" />
                                    deleting...
                                  </>
                                ) : chatbot.deployment?.status === 'deployed' ? (
                                  <>
                                    <div className="h-2 w-2 rounded-full mr-1.5 bg-green-500" />
                                    Deployed
                                  </>
                                ) : chatbot.deployment?.status === 'deploying' ? (
                                  <>
                                    <div className="h-2 w-2 rounded-full mr-1.5 bg-orange-500 animate-pulse" />
                                    Deploying
                                  </>
                                ) : (
                                  <>
                                    <div className={`h-2 w-2 rounded-full mr-1.5 ${
                                      chatbot.status === 'active' ? 'bg-green-500' :
                                      chatbot.status === 'preview' ? 'bg-blue-500' :
                                      chatbot.status === 'draft' ? 'bg-yellow-500' : 'bg-gray-500'
                                    }`} />
                                    {chatbot.status === 'active' ? 'Active' :
                                     chatbot.status === 'preview' ? 'Preview' :
                                     chatbot.status === 'draft' ? 'Draft' : chatbot.status}
                                  </>
                                )}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <CardDescription className="text-sm text-muted-foreground line-clamp-2">
                          {chatbot.description || 'No description provided'}
                        </CardDescription>
                      </CardHeader>
                      
                      <CardContent className="pt-0">
                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 rounded-lg">
                            <div className="flex items-center justify-center mb-1">
                              <MessageCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mr-1" />
                              <span className="text-lg font-bold text-blue-900 dark:text-blue-100">{chatbot.stats?.queries || 0}</span>
                            </div>
                            <p className="text-xs text-blue-700 dark:text-blue-300">Queries</p>
                          </div>
                          <div className="text-center p-3 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 rounded-lg">
                            <div className="flex items-center justify-center mb-1">
                              <Activity className="h-4 w-4 text-green-700 dark:text-green-400 mr-1" />
                              <span className="text-lg font-bold text-green-900 dark:text-green-100">{chatbot.stats?.successRate || 0}%</span>
                            </div>
                            <p className="text-xs text-green-700 dark:text-green-300">Success Rate</p>
                          </div>
                        </div>

                        {/* Actions - Only disable the delete button for the chatbot being deleted */}
                        <div className="flex space-x-2">
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="flex-1 group-hover:border-blue-300 group-hover:bg-blue-50 dark:group-hover:border-blue-600 dark:group-hover:bg-blue-900/30 transition-colors"
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
                            className="flex-1 group-hover:border-purple-300 group-hover:bg-purple-50 dark:group-hover:border-purple-600 dark:group-hover:bg-purple-900/30 transition-colors"
                          >
                            <Link href={`/dashboard/chatbots/${chatbot.id}/edit`}>
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={deletingChatbotId === chatbot.id}
                            className="group-hover:border-red-300 group-hover:bg-red-50 dark:group-hover:border-red-600 dark:group-hover:bg-red-900/30 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                            onClick={() => showDeleteChatbotDialog(chatbot)}
                          >
                            <Trash2 className="h-4 w-4" />
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
          hasAuraDB={hasAuraDB}
          vectorStoreName={vectorStoreName}
          auraDBInstanceName={auraDBInstanceName}
          documentsCount={vectorCount}
          isLoadingCount={isLoadingVectorCount}
          onConfirm={handleDeleteChatbot}
          onCancel={() => setShowDeleteDialog(false)}
          isDeleting={false}
        />
      )}

      {/* Background Deletion Notification */}
      {showDeletionNotification && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-6 min-w-[320px] max-w-md">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                {deletionProgress.includes('successfully') ? (
                  <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : deletionProgress.includes('Failed') ? (
                  <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                ) : (
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500"></div>
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  {deletionProgress.includes('successfully') ? 'Deletion Complete' :
                   deletionProgress.includes('Failed') ? 'Deletion Failed' :
                   'Deleting Chatbot'}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {deletionProgress}
                </p>
                {!deletionProgress.includes('successfully') && !deletionProgress.includes('Failed') && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    This is happening in the background. You can continue using the app.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
