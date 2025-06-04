'use client';

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import UserDropdown from "@/components/dashboard/UserDropdown";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, orderBy, doc, deleteDoc } from "firebase/firestore";
import { deleteChatbotFolder } from "@/lib/utils/logoUpload";
import { ClientFirebaseProjectService } from '@/services/clientFirebaseProjectService';

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
}

export default function ChatbotsPage() {
  const { user } = useAuth();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
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
  
  // Delete chatbot function
  const handleDeleteChatbot = async (id: string) => {
    if (!confirm("Are you sure you want to delete this chatbot? This action cannot be undone.")) {
      return;
    }
    
    setDeletingId(id);
    
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
      
      // Delete dedicated Firebase project (Fully Automated)
      try {
        console.log('🔥 Attempting automated Firebase project deletion for chatbot:', id);
        
        if (!user) {
          console.error('❌ No authenticated user');
          throw new Error('No authenticated user');
        }

        // Get auth token from Firebase user
        const token = await user.getIdToken();
        const firebaseDeleteResult = await ClientFirebaseProjectService.deleteProjectForChatbot(id, token);
        
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
      } catch (firebaseError) {
        console.error('❌ Error during automated Firebase project deletion:', firebaseError);
        
        alert(
          `❌ Automated Deletion System Error\n\n` +
          `Your chatbot has been deleted from this app, but there was a system error during Firebase project deletion.\n\n` +
          `Please manually delete the Firebase project from the Firebase Console to avoid ongoing charges.\n\n` +
          `Error details have been logged to the console.`
        );
        
        console.error('🔧 System error details:', firebaseError);
      }
      
      // Delete the document from Firestore
      await deleteDoc(doc(db, "chatbots", id));
      
      // Update local state
      setChatbots(chatbots.filter(chatbot => chatbot.id !== id));
      
      console.log('✅ Chatbot deleted successfully from Vercel, Storage, and Firestore');
    } catch (err: any) {
      console.error("Error deleting chatbot:", err);
      setError(`Failed to delete chatbot: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };
  
  useEffect(() => {
    fetchChatbots();
  }, [fetchChatbots]);
  
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
                <Link href="/dashboard/chatbots/new">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    Create New Chatbot
                  </Button>
                </Link>
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
          
          {isLoading ? (
            // Loading state
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            // Error state
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
              {error}
            </div>
          ) : chatbots.length === 0 ? (
            // Empty state
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
          ) : (
            // Chatbots list
            <div className="space-y-6">
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
                            Queries
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Success Rate
                          </th>
                          <th scope="col" className="relative px-6 py-3">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {chatbots.map((chatbot) => (
                          <tr key={chatbot.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center overflow-hidden">
                                  {chatbot.logoUrl ? (
                                    <img
                                      src={chatbot.logoUrl}
                                      alt={`${chatbot.name} logo`}
                                      className="h-10 w-10 rounded-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-blue-600 font-bold">{chatbot.name.slice(0, 1)}</span>
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{chatbot.name}</div>
                                  <div className="text-sm text-gray-500">{chatbot.description}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                chatbot.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : chatbot.status === 'preview'
                                  ? 'bg-blue-100 text-blue-800'
                                  : chatbot.status === 'draft'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {chatbot.status === 'active' ? 'Active' :
                                 chatbot.status === 'preview' ? 'Preview' :
                                 chatbot.status === 'draft' ? 'Draft' : chatbot.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {chatbot.stats?.queries || 0}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {chatbot.stats?.successRate || 0}%
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <Link 
                                href={`/dashboard/chatbots/${chatbot.id}`}
                                className="text-blue-600 hover:text-blue-900 mr-4"
                              >
                                View
                              </Link>
                              <Link 
                                href={`/dashboard/chatbots/${chatbot.id}/edit`}
                                className="text-blue-600 hover:text-blue-900 mr-4"
                              >
                                Edit
                              </Link>
                              <button 
                                className="text-red-600 hover:text-red-900"
                                onClick={() => handleDeleteChatbot(chatbot.id)}
                                disabled={deletingId === chatbot.id}
                              >
                                {deletingId === chatbot.id ? 'Deleting...' : 'Delete'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
