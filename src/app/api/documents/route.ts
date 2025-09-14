import { NextRequest, NextResponse } from 'next/server';
import { PineconeService } from '@/services/pineconeService';
import { DocumentDeletionService } from '@/services/documentDeletionService';
import { DatabaseService } from '@/services/databaseService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatbotId, userId, documentName, documentType, textContent, source, isPublic } = body;

    if (!chatbotId || !userId || !documentName || !textContent) {
      return NextResponse.json({ 
        error: 'Missing required fields: chatbotId, userId, documentName, textContent' 
      }, { status: 400 });
    }

    console.log(`📄 Processing document upload: ${documentName} for chatbot: ${chatbotId}`);
    console.log(`🔒 Document access level: ${isPublic ? 'Public' : 'Private'}`);

    const result = await PineconeService.uploadDocument(
      chatbotId,
      userId,
      documentName,
      documentType || 'text',
      textContent,
      source
    );

    if (result.success) {
      console.log(`✅ Successfully uploaded ${result.vectorCount} vectors for document: ${documentName}`);
      return NextResponse.json({
        success: true,
        message: `Document processed and uploaded successfully`,
        vectorCount: result.vectorCount,
        indexName: PineconeService.generateIndexName(chatbotId)
      });
    } else {
      console.error(`❌ Failed to upload document: ${documentName}`, result.error);
      return NextResponse.json({ 
        error: result.error || 'Failed to upload document' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Document upload API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during document upload' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatbotId, documentId, userId, documentName } = body;

    // Support both new document_id-based deletion and legacy documentName deletion
    if (!chatbotId || !userId) {
      return NextResponse.json({ 
        error: 'Missing required fields: chatbotId, userId' 
      }, { status: 400 });
    }

    if (!documentId && !documentName) {
      return NextResponse.json({ 
        error: 'Either documentId or documentName is required' 
      }, { status: 400 });
    }

    console.log(`🗑️ Document deletion request: chatbot=${chatbotId}, user=${userId}, documentId=${documentId}, documentName=${documentName}`);

    // NEW: Enhanced deletion using DocumentDeletionService (preferred method)
    if (documentId) {
      try {
        // Get chatbot deletion configuration
        const configResult = await DatabaseService.getChatbotDeletionConfig(chatbotId, userId);
        
        if (!configResult.success) {
          console.error('Failed to get chatbot deletion config:', configResult.error);
          return NextResponse.json({ 
            error: configResult.error || 'Failed to get chatbot configuration' 
          }, { status: 404 });
        }

        // Call the document deletion service for complete cleanup
        const deletionResult = await DocumentDeletionService.deleteDocument(
          documentId,
          userId,
          chatbotId,
          {
            pineconeIndex: configResult.config?.pineconeIndex,
            pineconeNamespace: configResult.config?.pineconeNamespace,
            firebaseBucket: configResult.config?.firebaseBucket
          }
        );

        if (deletionResult.success) {
          // Also delete local database metadata
          await DatabaseService.deleteDocumentMetadata(documentId, userId);
          
          console.log(`✅ Complete document deletion successful for ${documentId}`);
          return NextResponse.json({
            success: true,
            message: 'Document deleted successfully from all systems',
            details: {
              document_id: documentId,
              total_items_deleted: deletionResult.details?.total_items_deleted || 0,
              services_cleaned: ['pinecone', 'neo4j', 'firebase', 'database']
            }
          });
        } else {
          console.error('Document deletion service failed:', deletionResult.error);
          return NextResponse.json({ 
            error: deletionResult.error || 'Failed to delete document from storage systems',
            details: deletionResult.details
          }, { status: deletionResult.details?.partial_failures ? 207 : 500 });
        }

      } catch (error) {
        console.error('Enhanced document deletion failed:', error);
        // Fall back to legacy deletion for compatibility
        console.log('⚠️ Falling back to legacy Pinecone-only deletion');
      }
    }

    // LEGACY: Pinecone-only deletion (for backward compatibility or fallback)
    if (documentName) {
      console.log('🔄 Using legacy document deletion method');
      const result = await PineconeService.deleteDocument(chatbotId, documentName);

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Document deleted successfully (legacy mode - Pinecone only)',
          warning: 'This deletion method only removes Pinecone vectors. For complete cleanup, use documentId-based deletion.'
        });
      } else {
        return NextResponse.json({ 
          error: result.error || 'Failed to delete document' 
        }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      error: 'No valid deletion method available' 
    }, { status: 400 });

  } catch (error) {
    console.error('Document delete API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during document deletion' 
    }, { status: 500 });
  }
}
