// src/components/dialogs/VectorStoreNameDialog.tsx
'use client';

import { useState, useEffect } from 'react';
import { Database, AlertCircle, CheckCircle, RefreshCw, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getEmbeddingDimensions, getEmbeddingModelConfig } from '@/lib/embeddingModels';

interface ExistingIndex {
  name: string;
  displayName: string;
  dimensions?: number;
  stats?: any;
  isCompatible: boolean;
  vectorCount?: number;
}

interface Props {
  isOpen: boolean;
  onConfirm: (vectorStoreName: string, sanitizedName: string) => void;
  onCancel: () => void;
  userId: string;
  embeddingModel: string;
  isValidating?: boolean;
}

export function VectorStoreNameDialog({ 
  isOpen, 
  onConfirm, 
  onCancel, 
  userId, 
  embeddingModel,
  isValidating = false 
}: Props) {
  const [inputName, setInputName] = useState('');
  const [sanitizedName, setSanitizedName] = useState('');
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingIndexes, setExistingIndexes] = useState<ExistingIndex[]>([]);
  const [loadingIndexes, setLoadingIndexes] = useState(false);
  const [selectedExistingIndex, setSelectedExistingIndex] = useState<string | null>(null);
  const [showCreateNew, setShowCreateNew] = useState(false);

  const selectedEmbeddingDimensions = getEmbeddingDimensions(embeddingModel);
  const selectedEmbeddingConfig = getEmbeddingModelConfig(embeddingModel);

  // Load existing indexes on component mount
  useEffect(() => {
    if (isOpen) {
      loadExistingIndexes();
    }
  }, [isOpen, userId, embeddingModel]);

  const loadExistingIndexes = async () => {
    setLoadingIndexes(true);
    try {
      const response = await fetch('/api/vectorstore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list-with-dimensions',
          userId,
          requiredDimensions: selectedEmbeddingDimensions,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setExistingIndexes(result.indexes || []);
      } else {
        console.error('Failed to load existing indexes:', result.error);
      }
    } catch (error) {
      console.error('Error loading existing indexes:', error);
    } finally {
      setLoadingIndexes(false);
    }
  };

  // Validate name as user types
  useEffect(() => {
    if (!inputName.trim()) {
      setSanitizedName('');
      setIsAvailable(null);
      setError(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsChecking(true);
      setError(null);
      
      try {
        const response = await fetch('/api/vectorstore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'validate-name',
            userId,
            userInputName: inputName.trim(),
          }),
        });

        const result = await response.json();
        
        if (result.success) {
          setSanitizedName(result.sanitizedName);
          setIsAvailable(result.available);
          
          if (!result.available) {
            setError(`The name "${inputName}" is already taken. Try a different name.`);
          }
        } else {
          setError(result.error || 'Failed to validate name');
        }
      } catch (err) {
        setError('Failed to validate name');
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [inputName, userId]);

  const handleConfirm = () => {
    if (selectedExistingIndex) {
      // Use existing index
      const selectedIndex = existingIndexes.find(idx => idx.name === selectedExistingIndex);
      if (selectedIndex) {
        onConfirm(selectedIndex.displayName, selectedIndex.name);
      }
    } else if (inputName.trim() && sanitizedName && isAvailable) {
      // Create new index
      onConfirm(inputName.trim(), sanitizedName);
    }
  };

  const compatibleIndexes = existingIndexes.filter(idx => idx.isCompatible);
  const incompatibleIndexes = existingIndexes.filter(idx => !idx.isCompatible);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center space-x-3 mb-4">
          <Database className="h-6 w-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-medium">Name Your Knowledge Base</h3>
            <p className="text-sm text-gray-500">Choose a memorable name for your vector store</p>
          </div>
        </div>

        {/* Current embedding model info */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <Info className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Selected Embedding Model:</span>
          </div>
          <p className="text-sm text-blue-800 mt-1">
            {embeddingModel} ({selectedEmbeddingDimensions} dimensions)
            {selectedEmbeddingConfig?.supportsMultimodal && ' - Multimodal'}
          </p>
        </div>

        {/* Loading state */}
        {loadingIndexes && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm text-gray-600">Loading existing indexes...</span>
            </div>
          </div>
        )}

        {/* Compatible existing indexes */}
        {!loadingIndexes && compatibleIndexes.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Compatible Existing Indexes</h4>
            <div className="space-y-2">
              {compatibleIndexes.map((index) => (
                <div key={index.name} className="border border-gray-200 rounded-lg p-3">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="existing-index"
                      value={index.name}
                      checked={selectedExistingIndex === index.name}
                      onChange={() => {
                        setSelectedExistingIndex(index.name);
                        setShowCreateNew(false);
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{index.displayName}</span>
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                          ✓ Compatible
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {index.dimensions} dimensions
                        {index.vectorCount !== undefined && (
                          <span className="ml-2">{index.vectorCount.toLocaleString()} vectors</span>
                        )}
                      </div>
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Incompatible indexes info */}
        {!loadingIndexes && incompatibleIndexes.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Incompatible Indexes</h4>
            <div className="space-y-2">
              {incompatibleIndexes.map((index) => (
                <div key={index.name} className="border border-gray-200 rounded-lg p-3 opacity-60">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">{index.displayName}</span>
                    <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                      ⚠ Incompatible
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {index.dimensions} dimensions (requires {selectedEmbeddingDimensions})
                    {index.vectorCount !== undefined && (
                      <span className="ml-2">{index.vectorCount.toLocaleString()} vectors</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create new option */}
        <div className="mb-6">
          <div className="flex items-center space-x-3 mb-3">
            <input
              type="radio"
              name="existing-index"
              value="create-new"
              checked={showCreateNew}
              onChange={() => {
                setShowCreateNew(true);
                setSelectedExistingIndex(null);
              }}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className="text-sm font-medium text-gray-900">Create New Knowledge Base</span>
          </div>

          {showCreateNew && (
            <div className="ml-7 space-y-4">
              <div>
                <Label htmlFor="vectorstore-name">Knowledge Base Name</Label>
                <Input
                  id="vectorstore-name"
                  type="text"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                  placeholder="e.g., Company Docs, Product Manual, FAQ Database"
                  className={`mt-1 ${
                    error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 
                    isAvailable === true ? 'border-green-300 focus:border-green-500 focus:ring-green-500' : ''
                  }`}
                />
                
                {/* Validation feedback */}
                <div className="mt-2 min-h-[20px]">
                  {isChecking && (
                    <p className="text-sm text-gray-500 flex items-center">
                      <span className="animate-spin mr-2">⏳</span>
                      Checking availability...
                    </p>
                  )}
                  
                  {error && (
                    <p className="text-sm text-red-600 flex items-center">
                      <AlertCircle className="h-4 w-4 mr-1" />
                      {error}
                    </p>
                  )}
                  
                  {isAvailable === true && !isChecking && (
                    <p className="text-sm text-green-600 flex items-center">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      "{inputName}" is available!
                    </p>
                  )}
                </div>
              </div>

              {sanitizedName && sanitizedName !== inputName && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                  <p className="text-sm text-blue-800">
                    <strong>System name:</strong> {sanitizedName}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Names are sanitized for compatibility with the vector database
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info section */}
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-700">
            {compatibleIndexes.length > 0 
              ? "You can reuse an existing compatible knowledge base or create a new one. Reusing saves time and maintains consistency across chatbots."
              : "You can create a new knowledge base. After uploading documents, you'll be able to reuse this knowledge base for future chatbots with the same embedding model."
            }
          </p>
        </div>

        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onCancel} disabled={isValidating}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={
              (!selectedExistingIndex && (!inputName.trim() || !isAvailable || isChecking)) || 
              isValidating
            }
          >
            {isValidating ? 'Creating...' : 
             selectedExistingIndex ? 'Use Existing' : 'Create Knowledge Base'}
          </Button>
        </div>
      </div>
    </div>
  );
}