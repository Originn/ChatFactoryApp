'use client';

import { useState } from 'react';
import { AlertTriangle, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  chatbotName: string;
  hasVectorstore: boolean;
  hasAuraDB: boolean;
  vectorStoreName?: string; // Display name of the vector store
  auraDBInstanceName?: string; // Display name of the AuraDB instance
  documentsCount?: number;
  isLoadingCount?: boolean; // Loading state for vector count
  onConfirm: (deleteVectorstore: boolean, deleteAuraDB: boolean) => void;
  onCancel: () => void;
  isDeleting: boolean;
}

export function ChatbotDeletionDialog({
  chatbotName,
  hasVectorstore,
  hasAuraDB,
  vectorStoreName,
  auraDBInstanceName,
  documentsCount = 0,
  isLoadingCount = false,
  onConfirm,
  onCancel,
  isDeleting
}: Props) {
  const [deleteVectorstore, setDeleteVectorstore] = useState(false);
  const [deleteAuraDB, setDeleteAuraDB] = useState(false);

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

          {/* Pinecone Vector Store Deletion */}
          {hasVectorstore && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md mb-3">
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
                      Delete Pinecone vectors "{vectorStoreName || 'Knowledge Base'}"
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
                      <strong>Cleanup includes:</strong> Pinecone vectors, document metadata, Firebase files.
                      <br />
                      <strong>Note:</strong> This only deletes Pinecone data. Neo4j AuraDB (if present) is handled separately.
                      <br />
                      Saves on Pinecone storage costs.</>
                    )}
                  </p>
                  {!deleteVectorstore && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 font-medium">
                      ⚠️ Pinecone vectors will remain and continue incurring charges
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* AuraDB Instance Deletion */}
          {hasAuraDB && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="delete-aura"
                  checked={deleteAuraDB}
                  onCheckedChange={(checked) => setDeleteAuraDB(checked === true)}
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Database className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <label htmlFor="delete-aura" className="text-sm font-medium cursor-pointer text-gray-900 dark:text-gray-100">
                      Permanently delete AuraDB instance "{auraDBInstanceName || 'Graph Database'}"
                    </label>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    <strong className="text-red-600 dark:text-red-400">⚠️ IRREVERSIBLE:</strong> Neo4j AuraDB deletion cannot be undone.
                    <br />
                    All graph data, relationships, and queries will be permanently lost.
                    <br />
                    Stops Neo4j hosting charges immediately.
                  </p>
                  {!deleteAuraDB && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 font-medium">
                      ⚠️ AuraDB instance will remain active and continue incurring charges
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Show info when no AuraDB is detected */}
          {!hasAuraDB && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
              <div className="flex items-center space-x-2 mb-1">
                <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Neo4j AuraDB Status
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                No AuraDB instance detected for this chatbot. If you have an AuraDB instance that should be deleted,
                please contact support or delete it manually from the Neo4j console.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(deleteVectorstore, deleteAuraDB)}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete Chatbot'}
          </Button>
        </div>
      </div>
    </div>
  );
}
