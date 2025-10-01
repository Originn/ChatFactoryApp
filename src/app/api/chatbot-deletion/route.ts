import { NextRequest, NextResponse } from 'next/server';
import { DocumentDeletionService } from '@/services/documentDeletionService';
import { DatabaseService } from '@/services/databaseService';
import { Neo4jAuraService } from '@/services/neo4jAuraService';
import { ProjectMappingService } from '@/services/projectMappingService';
import { ReusableFirebaseProjectService } from '@/services/reusableFirebaseProjectService';
import { FirebaseProjectService } from '@/services/firebaseProjectService';
import { adminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';
import { Vercel } from '@vercel/sdk';
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

    // Read chatbot data FIRST before any deletion to preserve Vercel/Neo4j info
    let chatbotData: any = null;
    let vercelProjectId: string | null = null;
    let vercelProjectName: string | null = null;
    let neo4jData: any = null;

    try {
      const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
      if (chatbotDoc.exists) {
        chatbotData = chatbotDoc.data();
        vercelProjectId = chatbotData?.vercelProjectId || null;
        vercelProjectName = chatbotData?.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || null;
        neo4jData = chatbotData?.neo4j || null;
        console.log('📋 Chatbot data retrieved for deletion:', {
          hasVercelProjectId: !!vercelProjectId,
          hasVercelProjectName: !!vercelProjectName,
          hasNeo4jData: !!neo4jData
        });
      } else {
        console.warn('⚠️ Chatbot document not found - may have been deleted already');
      }
    } catch (error) {
      console.error('❌ Error reading chatbot data:', error);
    }

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
          // Use pre-loaded Neo4j data
          if (neo4jData) {
              console.log('🔍 Found Neo4j data in chatbot:', {
                hasUri: !!neo4jData.uri,
                hasDatabase: !!neo4jData.database,
                hasPassword: !!neo4jData.password
              });

              // Get instance ID directly from neo4j.instanceId field, fallback to URI extraction
              let instanceId = neo4jData.instanceId;

              if (instanceId) {
                console.log(`🎯 Using direct instance ID: ${instanceId}`);
              } else if (neo4jData.uri) {
                // Fallback: extract from URI if instanceId field is missing
                const uriMatch = neo4jData.uri.match(/\/\/([a-f0-9]+)\.databases\.neo4j\.io/);
                if (uriMatch) {
                  instanceId = uriMatch[1];
                  console.log(`🎯 Extracted instance ID from URI: ${instanceId}`);
                } else {
                  console.warn('⚠️ Could not extract instance ID from URI:', neo4jData.uri);
                }
              }

              if (instanceId) {
                console.log(`🗑️ Deleting AuraDB instance: ${instanceId}`);

                const deleted = await Neo4jAuraService.deleteInstance(instanceId);
                if (deleted) {
                  console.log(`✅ AuraDB instance deleted: ${instanceId}`);
                  results.details.services_cleaned.push('neo4j-aura');
                  results.auradb = true;
                } else {
                  console.warn('⚠️ Failed to delete AuraDB instance (may already be deleted)');
                  results.errors.push('Failed to delete AuraDB instance');
                }
              } else {
                console.log('❌ Could not determine instance ID from Neo4j data');
                results.errors.push('Could not determine Neo4j instance ID');
              }
          } else {
            console.log('📝 No Neo4j instance data found in chatbot');
            results.auradb = true; // Consider successful if no instance exists
          }
        } catch (auraError) {
          console.error('❌ AuraDB cleanup failed:', auraError);
          results.errors.push('Failed to clean up AuraDB instance');
        }
      } else {
        console.log('⏭️ Skipping AuraDB deletion (user choice)');
        results.auradb = true; // Consider it successful if not requested
      }

      // Step 3: Clean up Firebase project data and release project
      console.log('🏗️ Processing Firebase project cleanup and release...');

      let assignedProject = null;
      try {
        // Find the project assigned to this chatbot
        assignedProject = await ProjectMappingService.findProjectByChatbot(chatbotId);

        if (assignedProject) {
          console.log(`🎯 Found assigned project: ${assignedProject.projectId} (${assignedProject.projectType})`);

          // First, clean up the Firebase project data
          if (assignedProject.projectType === 'pool') {
            console.log('♻️ Cleaning up pool project data before release...');
            const cleanupResult = await ReusableFirebaseProjectService.cleanupChatbotData(
              chatbotId,
              userId || ''
            );

            if (cleanupResult.success) {
              console.log(`✅ Pool project data cleanup completed`);
              results.details.services_cleaned.push('firebase-pool-data');
            } else {
              results.errors.push(`Firebase pool cleanup: ${cleanupResult.message}`);
              console.error(`❌ Pool project cleanup failed: ${cleanupResult.message}`);
            }
          } else if (assignedProject.projectType === 'dedicated') {
            console.log('🗑️ Processing dedicated project deletion...');
            const deleteResult = await FirebaseProjectService.deleteProject(chatbotId);

            if (deleteResult.success) {
              console.log(`✅ Dedicated project deletion completed`);
              results.details.services_cleaned.push('firebase-dedicated-project');
            } else {
              results.errors.push(`Firebase dedicated project: ${deleteResult.error}`);
              console.error(`❌ Dedicated project deletion failed: ${deleteResult.error}`);
            }
          }

          // Then, release the project back to the pool (for pool projects only)
          if (assignedProject.projectType === 'pool') {
            console.log('🔄 Releasing pool project back to available state...');
            const releaseResult = await ProjectMappingService.releaseProject(assignedProject.projectId, chatbotId);

            if (releaseResult.success) {
              console.log(`✅ Successfully released project ${assignedProject.projectId}`);
              results.details.services_cleaned.push(`project-release-${assignedProject.projectType}`);
            } else {
              results.errors.push(`Failed to release project: ${releaseResult.message}`);
              console.error(`❌ Project release failed: ${releaseResult.message}`);
            }
          }
        } else {
          console.log('📭 No project assignment found for this chatbot');
        }
      } catch (error) {
        results.errors.push('Failed to process Firebase project cleanup');
        console.error('❌ Firebase project processing failed:', error);
      }

      // Step 4: Delete Vercel project
      console.log('🚀 Deleting Vercel project...');

      try {
        // Use pre-loaded Vercel project info
        if (vercelProjectId || vercelProjectName) {
          const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
          if (VERCEL_API_TOKEN) {
            const vercel = new Vercel({ bearerToken: VERCEL_API_TOKEN });
            const idOrName = vercelProjectId || vercelProjectName;

            console.log(`🎯 Attempting to delete Vercel project: ${idOrName}`);

            try {
              await vercel.projects.deleteProject({ idOrName });
              console.log(`✅ Successfully deleted Vercel project: ${idOrName}`);
              results.details.services_cleaned.push('vercel-project');
            } catch (vercelError: any) {
              if (vercelError.status === 404 || vercelError.message?.includes('not found')) {
                console.log(`⚠️ Vercel project ${idOrName} not found (may have been already deleted)`);
                results.details.services_cleaned.push('vercel-project-not-found');
              } else {
                console.error('❌ Vercel deletion error:', vercelError);
                results.errors.push(`Vercel project deletion: ${vercelError.message}`);
              }
            }
          } else {
            console.warn('⚠️ VERCEL_API_TOKEN not configured - skipping Vercel deletion');
            results.errors.push('Vercel API token not configured');
          }
        } else {
          console.log('📭 No Vercel project info found - skipping Vercel deletion');
        }
      } catch (error: any) {
        console.error('❌ Error during Vercel deletion:', error);
        results.errors.push(`Vercel deletion error: ${error.message}`);
      }

      // Step 5: Delete chatbot metadata from local database
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