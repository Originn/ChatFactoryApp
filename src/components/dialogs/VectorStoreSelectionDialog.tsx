// src/components/dialogs/VectorStoreSelectionDialog.tsx
'use client';

import { useState, useEffect } from 'react';
import { Database, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface VectorStoreOption {
  name: string;
  displayName: string;
  stats?: {
    totalVectorCount: number;
  };
}

interface Props {
  isOpen: boolean;
  onSelectExisting: (indexName: string, displayName: string) => void;
  onCreateNew: () => void;
  onCancel: () => void;
  userId: string;
}

export function VectorStoreSelectionDialog({ isOpen, onSelectExisting, onCreateNew, onCancel, userId }: Props) {
  const [vectorStores, setVectorStores] = useState<VectorStoreOption[]>([]);
  const [filteredStores, setFilteredStores] = useState<VectorStoreOption[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user's vector stores
  useEffect(() => {
    if (isOpen && userId) {
      loadVectorStores();
    }
  }, [isOpen, userId]);

  // Filter stores based on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStores(vectorStores);
    } else {
      const filtered = vectorStores.filter(store =>
        store.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredStores(filtered);
    }
  }, [searchQuery, vectorStores]);

  const loadVectorStores = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/vectorstore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'list',
          userId,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setVectorStores(result.indexes);
      } else {
        setError(result.error || 'Failed to load vector stores');
      }
    } catch (err) {
      setError('Failed to load vector stores');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
        <div className="flex items-center space-x-3 mb-4">
          <Database className="h-6 w-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-medium">Choose Knowledge Base</h3>
            <p className="text-sm text-gray-500">Select an existing one or create new</p>
          </div>
        </div>

        <div className="mb-6">
          {/* Create New Option */}
          <div className="border border-dashed border-blue-300 rounded-lg p-4 mb-4 bg-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Plus className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-900">Create New Knowledge Base</p>
                  <p className="text-sm text-blue-700">Start fresh with a new vector store</p>
                </div>
              </div>
              <Button onClick={onCreateNew} size="sm">
                Create New
              </Button>
            </div>
          </div>

          {/* Existing Vector Stores */}
          {vectorStores.length > 0 && (
            <>
              <div className="mb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search your knowledge bases..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {isLoading ? (
                  <div className="text-center py-8 text-gray-500">
                    Loading your knowledge bases...
                  </div>
                ) : filteredStores.length > 0 ? (
                  filteredStores.map((store) => (
                    <div
                      key={store.name}
                      className="border rounded-lg p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => onSelectExisting(store.name, store.displayName)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{store.displayName}</p>
                          <p className="text-sm text-gray-500">
                            {store.stats?.totalVectorCount || 0} vectors
                          </p>
                        </div>
                        <Button variant="outline" size="sm">
                          Use This
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    {searchQuery ? 'No matching knowledge bases found' : 'No existing knowledge bases found'}
                  </div>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded mt-4">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
