'use client';

import { useState } from 'react';
import { AlertTriangle, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  chatbotName: string;
  hasVectorstore: boolean;
  vectorStoreName?: string; // Display name of the vector store
  documentsCount?: number;
  isLoadingCount?: boolean; // Loading state for vector count
  onConfirm: (deleteVectorstore: boolean) => void;
  onCancel: () => void;
  isDeleting: boolean;
}

export function ChatbotDeletionDialog({ 
  chatbotName, 
  hasVectorstore, 
  vectorStoreName,
  documentsCount = 0, 
  isLoadingCount = false,
  onConfirm, 
  onCancel, 
  isDeleting 
}: Props) {
  const [deleteVectorstore, setDeleteVectorstore] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-60 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Delete Chatbot</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
            Delete <strong>"{chatbotName}"</strong>? This will remove:
          </p>
          
          <ul className="text-sm text-gray-600 dark:text-gray-400 mb-4 space-y-1">
            <li>• Chatbot configuration and settings</li>
            <li>• Vercel deployment (if deployed)</li>
            <li>• Firebase storage files</li>
            <li>• Document metadata from database</li>
          </ul>

          {hasVectorstore && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="delete-vs"
                  checked={deleteVectorstore}
                  onCheckedChange={(checked) => setDeleteVectorstore(checked === true)}
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Database className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <label htmlFor="delete-vs" className="text-sm font-medium cursor-pointer text-gray-900 dark:text-gray-100">
                      Also delete "{vectorStoreName || 'Knowledge Base'}"
                    </label>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {isLoadingCount ? (
                      <span className="flex items-center">
                        <div className="animate-spin rounded-full h-3 w-3 border-t border-b border-gray-500 dark:border-gray-400 mr-2"></div>
                        Loading vector count...
                      </span>
                    ) : (
                      <>Contains {documentsCount.toLocaleString()} processed chunks and embeddings.
                      <br />
                      <strong>Complete cleanup:</strong> Pinecone vectors, Neo4j graph, Firebase files.
                      <br />
                      Deleting saves on storage costs and ensures no orphaned data.</>
                    )}
                  </p>
                  {!deleteVectorstore && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 font-medium">
                      ⚠️ Vector store will remain and continue incurring charges
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => onConfirm(deleteVectorstore)} 
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Chatbot'}
          </Button>
        </div>
      </div>
    </div>
  );
}
