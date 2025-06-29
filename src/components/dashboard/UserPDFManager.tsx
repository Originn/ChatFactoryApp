// UserPDFManager - Component for users to view and manage their uploaded PDFs
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserPDFMetadata, PDFAccessResponse } from '@/types/pdf';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip } from '@/components/ui/custom-tooltip';
import { format } from 'date-fns';

interface UserPDFManagerProps {
  chatbotId?: string; // Optional filter for specific chatbot
  showChatbotFilter?: boolean;
}

export default function UserPDFManager({ chatbotId, showChatbotFilter = false }: UserPDFManagerProps) {
  const { user } = useAuth();
  const [pdfs, setPdfs] = useState<UserPDFMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingPdfId, setDeletingPdfId] = useState<string | null>(null);

  // Load user's PDFs
  const loadPDFs = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        userId: user.uid,
        ...(chatbotId && { chatbotId })
      });

      const response = await fetch(`/api/user-pdfs?${queryParams}`);
      const result = await response.json();

      if (result.success) {
        setPdfs(result.pdfs);
      } else {
        setError(result.error || 'Failed to load PDFs');
      }
    } catch (err) {
      setError('Error loading PDFs');
      console.error('PDF loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPDFs();
  }, [user?.uid, chatbotId]);

  // Get access URL for a PDF
  const getPDFAccess = async (pdf: UserPDFMetadata) => {
    if (!user?.uid) return;

    try {
      // For public PDFs, use the stored public URL
      if (pdf.isPublic && pdf.publicUrl) {
        window.open(pdf.publicUrl, '_blank');
        return;
      }

      // For private PDFs, get a signed URL
      const response = await fetch(`/api/user-pdfs/${pdf.id}/access?userId=${user.uid}`);
      const result: PDFAccessResponse = await response.json();

      if (result.success) {
        window.open(result.accessUrl, '_blank');
      } else {
        setError(result.error || 'Failed to access PDF');
      }
    } catch (err) {
      setError('Error accessing PDF');
      console.error('PDF access error:', err);
    }
  };

  // Toggle PDF privacy
  const togglePDFPrivacy = async (pdf: UserPDFMetadata) => {
    if (!user?.uid) return;

    try {
      const response = await fetch(`/api/user-pdfs/${pdf.id}/privacy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPublic: !pdf.isPublic,
          userId: user.uid
        })
      });

      const result = await response.json();

      if (result.success) {
        // Refresh PDFs list
        await loadPDFs();
      } else {
        setError(result.error || 'Failed to update privacy');
      }
    } catch (err) {
      setError('Error updating privacy');
      console.error('Privacy toggle error:', err);
    }
  };

  // Delete PDF completely
  const deletePDF = async (pdf: UserPDFMetadata) => {
    if (!user?.uid) return;

    // Confirmation dialog
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${pdf.pdfFileName}"?\n\n` +
      `This will permanently remove:\n` +
      `• The PDF file from storage\n` +
      `• All document metadata\n` +
      `• Any search vectors\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      setDeletingPdfId(pdf.id);
      
      const response = await fetch('/api/user-pdfs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfId: pdf.id,
          userId: user.uid
        })
      });

      const result = await response.json();

      if (result.success) {
        // Remove from local state immediately for better UX
        setPdfs(prev => prev.filter(p => p.id !== pdf.id));
        
        // Refresh list to ensure consistency
        await loadPDFs();
      } else {
        setError(result.error || 'Failed to delete PDF');
      }
    } catch (err) {
      setError('Error deleting PDF');
      console.error('PDF deletion error:', err);
    } finally {
      setDeletingPdfId(null);
    }
  };

  // Get status badge color
  const getStatusBadge = (status: UserPDFMetadata['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'converting':
        return <Badge className="bg-yellow-100 text-yellow-800">Converting</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">Loading your PDFs...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Your CHM PDFs {chatbotId && '(This Chatbot)'}
          {pdfs.length > 0 && <span className="text-sm font-normal ml-2">({pdfs.length} files)</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600 text-sm">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setError(null)}
              className="mt-2"
            >
              Dismiss
            </Button>
          </div>
        )}

        {pdfs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No CHM PDFs uploaded yet.</p>
            <p className="text-sm mt-1">Upload CHM files to see them here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pdfs.map((pdf) => (
              <div
                key={pdf.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-medium text-gray-900">
                        {pdf.pdfFileName}
                      </h3>
                      {getStatusBadge(pdf.status)}
                      <Tooltip
                        content={pdf.isPublic 
                          ? "Public: Anyone with the link can access this PDF"
                          : "Private: Only you can access this PDF with signed URLs"
                        }
                      >
                        <Badge variant={pdf.isPublic ? "default" : "secondary"}>
                          {pdf.isPublic ? '🔓 Public' : '🔒 Private'}
                        </Badge>
                      </Tooltip>
                    </div>
                    
                    <div className="text-sm text-gray-500 space-y-1">
                      <p>Original: {pdf.originalFileName}</p>
                      <p>Size: {formatFileSize(pdf.fileSize)}</p>
                      <p>Uploaded: {format(new Date(pdf.uploadedAt), 'MMM d, yyyy \'at\' h:mm a')}</p>
                      {pdf.vectorCount && (
                        <p>Vectors: {pdf.vectorCount.toLocaleString()}</p>
                      )}
                      {pdf.error && (
                        <p className="text-red-600">Error: {pdf.error}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {/* Always show View PDF button if we have a storage path (PDF exists) */}
                    {pdf.firebaseStoragePath && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => getPDFAccess(pdf)}
                      >
                        View PDF
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => togglePDFPrivacy(pdf)}
                      disabled={!pdf.firebaseStoragePath} // Only disable if no PDF exists
                    >
                      Make {pdf.isPublic ? 'Private' : 'Public'}
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deletePDF(pdf)}
                      disabled={deletingPdfId === pdf.id}
                    >
                      {deletingPdfId === pdf.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {pdfs.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={loadPDFs}
            >
              Refresh List
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
