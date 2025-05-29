// src/components/dialogs/VectorStoreNameDialog.tsx
'use client';

import { useState, useEffect } from 'react';
import { Database, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  isOpen: boolean;
  onConfirm: (vectorStoreName: string, sanitizedName: string) => void;
  onCancel: () => void;
  userId: string;
  isValidating?: boolean;
}

export function VectorStoreNameDialog({ isOpen, onConfirm, onCancel, userId, isValidating = false }: Props) {
  const [inputName, setInputName] = useState('');
  const [sanitizedName, setSanitizedName] = useState('');
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          headers: {
            'Content-Type': 'application/json',
          },
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
    if (inputName.trim() && sanitizedName && isAvailable) {
      onConfirm(inputName.trim(), sanitizedName);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center space-x-3 mb-4">
          <Database className="h-6 w-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-medium">Name Your Knowledge Base</h3>
            <p className="text-sm text-gray-500">Choose a memorable name for your vector store</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-700 mb-4">
            Give your knowledge base a name so you can identify and reuse it later. 
            You can attach the same knowledge base to multiple chatbots.
          </p>

          <div className="space-y-4">
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
        </div>

        <div className="flex justify-end space-x-3">
          <Button variant="outline" onClick={onCancel} disabled={isValidating}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!inputName.trim() || !isAvailable || isChecking || isValidating}
          >
            {isValidating ? 'Creating...' : 'Create Knowledge Base'}
          </Button>
        </div>
      </div>
    </div>
  );
}
