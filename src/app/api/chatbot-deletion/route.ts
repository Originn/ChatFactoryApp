import { NextRequest, NextResponse } from 'next/server';
import { DocumentDeletionService } from '@/services/documentDeletionService';
import { DatabaseService } from '@/services/databaseService';
import { Neo4jAuraService } from '@/services/neo4jAuraService';
import { adminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';
import type {
  ChatbotDeletionRequest,
  ChatbotDeletionResponse,
  ChatbotDeletionPreviewRequest,
  ChatbotDeletionHealthCheckRequest
} from '@/types/chatbot-deletion';

/**
 * Enhanced Chatbot Deletion API
 * =============================
 * 
 * Integrates with the document-deletion-gcp-wizechat service to handle
 * complete chatbot deletion including:
 * - All document vectors from Pinecone
 * - All graph nodes from Neo4j 
 * - All files from Firebase Storage
 * - All metadata from local database
 * 
 * Called by ChatbotDeletionDialog when user confirms deletion.
 */

export async function DELETE(request: NextRequest): Promise<NextResponse<ChatbotDeletionResponse>> {
  try {
    const body: ChatbotDeletionRequest = await request.json();
    const { chatbotId, userId, deleteVectorstore = false, deleteAuraDB = false } = body;

    if (!chatbotId || !userId) {
      return NextResponse.json({
        success: false,
        message: 'Missing required fields: chatbotId, userId',
        details: { chatbot_id: chatbotId || 'unknown' }
      } as ChatbotDeletionResponse, { status: 400 });
    }

    console.log(`🗑️ Chatbot deletion request: ${chatbotId} (deleteVectorstore: ${deleteVectorstore}, deleteAuraDB: ${deleteAuraDB})`);

    const results = {
      chatbot: false,
      documents: false,
      vectorstore: false,
      auradb: false,
      errors: [] as string[],
      details: {
        documents_deleted: 0,
        total_items_deleted: 0,
        services_cleaned: [] as string[]
      }
    };

    try {
      // Step 1: Delete all documents if vectorstore deletion is requested
      if (deleteVectorstore) {
        console.log('📋 Deleting all chatbot documents...');
        
        const documentDeletionResult = await DocumentDeletionService.deleteChatbotDocuments(
          chatbotId,
          userId
        );

        if (documentDeletionResult.success) {
          results.documents = true;
          results.details.documents_deleted = documentDeletionResult.successful_deletions;
          results.details.total_items_deleted = documentDeletionResult.results.reduce(
            (sum, result) => sum + (result.details?.total_items_deleted || 0), 
            0
          );
          results.details.services_cleaned = ['pinecone', 'neo4j', 'firebase'];
          
          console.log(`✅ Successfully deleted ${documentDeletionResult.successful_deletions} documents`);
          console.log(`📊 Total items cleaned: ${results.details.total_items_deleted}`);

          if (documentDeletionResult.failed_deletions > 0) {
            results.errors.push(`${documentDeletionResult.failed_deletions} documents failed to delete completely`);
            console.warn(`⚠️ ${documentDeletionResult.failed_deletions} documents had deletion issues`);
          }
        } else {
          results.errors.push('Failed to delete chatbot documents');
          console.error('❌ Document deletion failed');
        }

        results.vectorstore = documentDeletionResult.success;
      } else {
        console.log('⏭️ Skipping vectorstore deletion (user choice)');
        results.vectorstore = true; // Consider it successful if not requested
      }

      // Step 2: Clean up Neo4j AuraDB instance (if requested)
      if (deleteAuraDB) {
        console.log('🗄️ Cleaning up AuraDB instance...');
        try {
          // Get chatbot configuration to find Firebase project
          const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
          if (chatbotDoc.exists) {
            const chatbotData = chatbotDoc.data();
            const firebaseProjectId = chatbotData?.firebaseProjectId || chatbotData?.deployment?.firebaseProjectId;

            if (firebaseProjectId) {
              // Get Firebase project with Neo4j instance
              // For reusable projects, the document ID is in format: ${projectId}-${chatbotId}
              const compoundDocId = `${firebaseProjectId}-${chatbotId}`;
              console.log(`🔍 Looking for Firebase project document: ${compoundDocId}`);
              const projectDoc = await adminDb.collection('firebaseProjects').doc(compoundDocId).get();
              if (projectDoc.exists) {
                const projectData = projectDoc.data();
                if (projectData?.neo4jInstance?.instanceId) {
                  const instanceId = projectData.neo4jInstance.instanceId;
                  console.log(`🗑️ Deleting AuraDB instance: ${instanceId}`);

                  const deleted = await Neo4jAuraService.deleteInstance(instanceId);
                  if (deleted) {
                    console.log(`✅ AuraDB instance deleted: ${instanceId}`);

                    // Update Firebase project to remove Neo4j instance reference
                    await adminDb.collection('firebaseProjects').doc(compoundDocId).update({
                      'neo4jInstance.status': 'deleted',
                      updatedAt: admin.firestore.Timestamp.now()
                    });

                    results.details.services_cleaned.push('neo4j-aura');
                    results.auradb = true;
                  } else {
                    console.warn('⚠️ Failed to delete AuraDB instance (may already be deleted)');
                    results.errors.push('Failed to delete AuraDB instance');
                  }
                } else {
                  console.log('📝 No AuraDB instance found for this chatbot');
                  results.auradb = true; // Consider successful if no instance exists
                }
              } else {
                console.log('📝 No Firebase project found for this chatbot');
                results.auradb = true; // Consider successful if no project exists
              }
            } else {
              console.log('📝 No Firebase project ID found for this chatbot');
              results.auradb = true; // Consider successful if no project ID exists
            }
          } else {
            console.log('📝 Chatbot document not found');
            results.auradb = true; // Consider successful if chatbot not found
          }
        } catch (auraError) {
          console.error('❌ AuraDB cleanup failed:', auraError);
          results.errors.push('Failed to clean up AuraDB instance');
        }
      } else {
        console.log('⏭️ Skipping AuraDB deletion (user choice)');
        results.auradb = true; // Consider it successful if not requested
      }

      // Step 3: Delete chatbot metadata from local database
      console.log('🗄️ Deleting chatbot metadata...');

      try {
        // Delete the chatbot document from Firestore
        await adminDb.collection('chatbots').doc(chatbotId).delete();
        results.chatbot = true;
        console.log('✅ Chatbot metadata deletion completed');
      } catch (error) {
        results.errors.push('Failed to delete chatbot metadata');
        console.error('❌ Chatbot metadata deletion failed:', error);
      }

      // Determine overall success
      const overallSuccess = results.chatbot && results.documents && results.vectorstore && results.auradb;

      if (overallSuccess) {
        console.log(`✅ Complete chatbot deletion successful: ${chatbotId}`);
        return NextResponse.json({
          success: true,
          message: 'Chatbot deleted successfully',
          details: {
            chatbot_id: chatbotId,
            vectorstore_deleted: deleteVectorstore,
            auradb_deleted: deleteAuraDB,
            documents_deleted: results.details.documents_deleted,
            total_items_deleted: results.details.total_items_deleted,
            services_cleaned: results.details.services_cleaned
          }
        });
      } else {
        console.log(`⚠️ Partial chatbot deletion for ${chatbotId}`);
        return NextResponse.json({
          success: false,
          message: 'Chatbot deletion completed with errors',
          errors: results.errors,
          details: {
            chatbot_id: chatbotId,
            chatbot_deleted: results.chatbot,
            vectorstore_deleted: results.vectorstore,
            auradb_deleted: results.auradb,
            documents_deleted: results.details.documents_deleted,
            total_items_deleted: results.details.total_items_deleted
          }
        }, { status: 207 }); // Multi-Status
      }

    } catch (error) {
      console.error('❌ Chatbot deletion service error:', error);
      return NextResponse.json({
        success: false,
        message: `Chatbot deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: {
          chatbot_id: chatbotId,
          ...results.details
        }
      } as ChatbotDeletionResponse, { status: 500 });
    }

  } catch (error) {
    console.error('Chatbot deletion API error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error during chatbot deletion',
      details: { chatbot_id: 'unknown' }
    } as ChatbotDeletionResponse, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatbotDeletionPreviewRequest | ChatbotDeletionHealthCheckRequest = await request.json();
    const { action } = body;

    if (action === 'health-check') {
      // Health check for deletion service
      const healthResult = await DocumentDeletionService.healthCheck();
      
      return NextResponse.json({
        success: healthResult.success,
        deletion_service_available: healthResult.success,
        services_available: healthResult.services_available,
        error: healthResult.error
      });
    }

    if (action === 'preview-deletion') {
      // Preview what would be deleted
      const previewBody = body as ChatbotDeletionPreviewRequest;
      const { chatbotId, userId } = previewBody;

      if (!chatbotId || !userId) {
        return NextResponse.json({
          success: false,
          error: 'Missing required fields for preview: chatbotId, userId'
        }, { status: 400 });
      }

      try {
        // Get document count for preview
        const documentIds = await DatabaseService.getDocumentIdsByChatbot(chatbotId, userId);
        const config = await DatabaseService.getChatbotDeletionConfig(chatbotId, userId);

        return NextResponse.json({
          success: true,
          preview: {
            chatbot_id: chatbotId,
            documents_count: documentIds.length,
            document_ids: documentIds,
            pinecone_index: config.config?.pineconeIndex,
            firebase_bucket: config.config?.firebaseBucket,
            estimated_cleanup_time: Math.max(30, documentIds.length * 2) // seconds
          }
        });
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: `Preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      error: 'Invalid action. Supported actions: health-check, preview-deletion' 
    }, { status: 400 });

  } catch (error) {
    console.error('Chatbot deletion API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}