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
  onConfirm: (deleteVectorstore: boolean) => void;
  onCancel: () => void;
  isDeleting: boolean;
}

export function ChatbotDeletionDialog({ 
  chatbotName, 
  hasVectorstore, 
  vectorStoreName,
  documentsCount = 0, 
  onConfirm, 
  onCancel, 
  isDeleting 
}: Props) {
  const [deleteVectorstore, setDeleteVectorstore] = useState(false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center space-x-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-red-600" />
          <div>
            <h3 className="text-lg font-medium">Delete Chatbot</h3>
            <p className="text-sm text-gray-500">This action cannot be undone</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-700 mb-4">
            Delete <strong>"{chatbotName}"</strong>? This will remove:
          </p>
          
          <ul className="text-sm text-gray-600 mb-4 space-y-1">
            <li>• Chatbot configuration and settings</li>
            <li>• Vercel deployment (if deployed)</li>
            <li>• Firebase storage files (but not buckets)</li>
            <li>• Document metadata from database</li>
          </ul>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md mb-4">
            <p className="text-xs text-amber-800">
              ⚠️ <strong>Manual cleanup may be required:</strong> Firebase Storage buckets and dedicated Firebase projects may require manual deletion from the Firebase Console to avoid continued charges.
            </p>
          </div>

          {hasVectorstore && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="delete-vs"
                  checked={deleteVectorstore}
                  onCheckedChange={(checked) => setDeleteVectorstore(checked === true)}
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <Database className="h-4 w-4 text-yellow-600" />
                    <label htmlFor="delete-vs" className="text-sm font-medium cursor-pointer">
                      Also delete "{vectorStoreName || 'Knowledge Base'}"
                    </label>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    Contains {documentsCount} processed chunks and embeddings.
                    Deleting saves on Pinecone storage costs.
                  </p>
                  {!deleteVectorstore && (
                    <p className="text-xs text-amber-700 mt-1 font-medium">
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
