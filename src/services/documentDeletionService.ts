/**
 * Document Deletion Service for ChatFactoryApp
 * ============================================
 * 
 * Service that integrates with the document-deletion-gcp-wizechat container
 * to handle complete document lifecycle management across:
 * - Pinecone vector store
 * - Neo4j graph database  
 * - Firebase Storage
 * - Local database metadata
 * 
 * Called when users delete documents or chatbots to ensure no orphaned data.
 */

interface DeletionServiceResponse {
  success: boolean;
  document_id: string;
  total_items_deleted: number;
  timestamp: string;
  error?: string; // Top-level error message for complete failures
  deletion_results: {
    pinecone: {
      success: boolean;
      items_deleted: number;
      details: string;
      error?: string;
    };
    neo4j: {
      success: boolean;
      items_deleted: number;
      details: string;
      error?: string;
    };
    firebase: {
      success: boolean;
      items_deleted: number;
      details: string;
      error?: string;
    };
  };
  partial_failures?: string[];
}

interface DocumentDeletionRequest {
  document_id: string;
  user_id: string;
  chatbot_id: string;
  pinecone_index?: string;
  pinecone_namespace?: string;
  firebase_bucket?: string;
}

interface BulkDocumentDeletionResult {
  success: boolean;
  total_documents: number;
  successful_deletions: number;
  failed_deletions: number;
  results: Array<{
    document_id: string;
    success: boolean;
    error?: string;
    details?: DeletionServiceResponse;
  }>;
}

export class DocumentDeletionService {
  private static readonly DELETION_SERVICE_URL = process.env.DOCUMENT_DELETION_SERVICE_URL || 
    'https://document-deletion-service-url.run.app';

  /**
   * Delete a single document across all storage systems
   * 
   * @param documentId - Unique document identifier
   * @param userId - User ID for validation
   * @param chatbotId - Chatbot ID for validation
   * @param options - Optional service-specific configuration
   * @returns Promise with deletion results
   */
  static async deleteDocument(
    documentId: string,
    userId: string,
    chatbotId: string,
    options: {
      pineconeIndex?: string;
      pineconeNamespace?: string;
      firebaseBucket?: string;
    } = {}
  ): Promise<{ success: boolean; error?: string; details?: DeletionServiceResponse }> {
    
    console.log(`🗑️ Initiating document deletion: ${documentId}`);
    console.log(`   User: ${userId}, Chatbot: ${chatbotId}`);

    try {
      // Prepare request payload
      const requestPayload: DocumentDeletionRequest = {
        document_id: documentId,
        user_id: userId,
        chatbot_id: chatbotId,
        ...options
      };

      // Call the deletion service container
      const response = await fetch(`${this.DELETION_SERVICE_URL}/delete-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add authentication headers if needed in future
          // 'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify(requestPayload),
        // Timeout after 5 minutes (deletion can be slow for large documents)
        signal: AbortSignal.timeout(300000)
      });

      const responseData: DeletionServiceResponse = await response.json();

      if (response.ok) {
        // Success (200) or partial success (207)
        const isPartialFailure = response.status === 207;
        
        console.log(`${isPartialFailure ? '⚠️' : '✅'} Document deletion ${isPartialFailure ? 'partially completed' : 'completed'}:`);
        console.log(`   Total items deleted: ${responseData.total_items_deleted}`);
        console.log(`   Pinecone: ${responseData.deletion_results.pinecone.success ? '✅' : '❌'} (${responseData.deletion_results.pinecone.items_deleted} items)`);
        console.log(`   Neo4j: ${responseData.deletion_results.neo4j.success ? '✅' : '❌'} (${responseData.deletion_results.neo4j.items_deleted} items)`);
        console.log(`   Firebase: ${responseData.deletion_results.firebase.success ? '✅' : '❌'} (${responseData.deletion_results.firebase.items_deleted} items)`);

        if (responseData.partial_failures) {
          console.warn(`   Failed services: ${responseData.partial_failures.join(', ')}`);
        }

        return {
          success: responseData.success,
          details: responseData
        };
      } else {
        // Complete failure (4xx, 5xx)
        console.error(`❌ Document deletion failed (${response.status}):`, responseData);
        return {
          success: false,
          error: responseData.error || `Deletion service error: ${response.status}`,
          details: responseData
        };
      }

    } catch (error) {
      console.error('❌ Document deletion service error:', error);
      
      // Handle specific error types
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            error: 'Document deletion timed out (5 minutes). The operation may still be running.'
          };
        } else if (error.message.includes('fetch')) {
          return {
            success: false,
            error: 'Unable to connect to document deletion service. Please try again later.'
          };
        }
      }

      return {
        success: false,
        error: `Document deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Delete multiple documents in batch (sequential processing for reliability)
   * 
   * @param documentIds - Array of document IDs to delete
   * @param userId - User ID for validation
   * @param chatbotId - Chatbot ID for validation
   * @param options - Optional service-specific configuration
   * @returns Promise with batch deletion results
   */
  static async deleteDocumentsBatch(
    documentIds: string[],
    userId: string,
    chatbotId: string,
    options: {
      pineconeIndex?: string;
      pineconeNamespace?: string;
      firebaseBucket?: string;
    } = {}
  ): Promise<BulkDocumentDeletionResult> {
    
    console.log(`🗑️ Initiating batch document deletion: ${documentIds.length} documents`);

    const results: BulkDocumentDeletionResult['results'] = [];
    let successCount = 0;
    let failureCount = 0;

    // Process each document sequentially to avoid overwhelming the deletion service
    for (const documentId of documentIds) {
      try {
        const result = await this.deleteDocument(documentId, userId, chatbotId, options);
        
        results.push({
          document_id: documentId,
          success: result.success,
          error: result.error,
          details: result.details
        });

        if (result.success) {
          successCount++;
        } else {
          failureCount++;
        }

        // Brief delay between deletions to avoid rate limiting
        if (documentIds.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (error) {
        failureCount++;
        results.push({
          document_id: documentId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const batchResult: BulkDocumentDeletionResult = {
      success: failureCount === 0,
      total_documents: documentIds.length,
      successful_deletions: successCount,
      failed_deletions: failureCount,
      results
    };

    console.log(`📊 Batch deletion completed: ${successCount}/${documentIds.length} successful`);
    if (failureCount > 0) {
      console.warn(`⚠️ ${failureCount} documents failed to delete completely`);
    }

    return batchResult;
  }

  /**
   * Delete all documents for a specific chatbot (used when deleting entire chatbot)
   * 
   * @param chatbotId - Chatbot ID whose documents to delete
   * @param userId - User ID for validation
   * @returns Promise with deletion results
   */
  static async deleteChatbotDocuments(
    chatbotId: string,
    userId: string
  ): Promise<BulkDocumentDeletionResult> {
    
    console.log(`🗑️ Deleting all documents for chatbot: ${chatbotId}`);

    try {
      // Get all document IDs for this chatbot from the database
      // This assumes we have a method to retrieve document_ids by chatbot
      const { DatabaseService } = await import('@/services/databaseService');
      const documentIds = await DatabaseService.getDocumentIdsByChatbot(chatbotId, userId);

      if (documentIds.length === 0) {
        console.log(`ℹ️ No documents found for chatbot: ${chatbotId}`);
        return {
          success: true,
          total_documents: 0,
          successful_deletions: 0,
          failed_deletions: 0,
          results: []
        };
      }

      console.log(`📋 Found ${documentIds.length} documents to delete for chatbot: ${chatbotId}`);

      // Delete all documents in batch
      return await this.deleteDocumentsBatch(
        documentIds,
        userId,
        chatbotId,
        {
          pineconeIndex: `chatbot-${chatbotId}`, // Default index naming convention
          pineconeNamespace: "", // Default namespace
        }
      );

    } catch (error) {
      console.error(`❌ Failed to retrieve documents for chatbot ${chatbotId}:`, error);
      return {
        success: false,
        total_documents: 0,
        successful_deletions: 0,
        failed_deletions: 1,
        results: [{
          document_id: 'unknown',
          success: false,
          error: `Failed to retrieve chatbot documents: ${error instanceof Error ? error.message : 'Unknown error'}`
        }]
      };
    }
  }

  /**
   * Test connectivity to the deletion service
   * 
   * @returns Promise with health check results
   */
  static async healthCheck(): Promise<{
    success: boolean;
    services_available?: {
      pinecone: boolean;
      neo4j: boolean;
      firebase: boolean;
    };
    error?: string;
  }> {
    
    try {
      const response = await fetch(`${this.DELETION_SERVICE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(10000) // 10 second timeout for health check
      });

      if (response.ok) {
        const healthData = await response.json();
        return {
          success: true,
          services_available: healthData.services_available
        };
      } else {
        return {
          success: false,
          error: `Health check failed: ${response.status}`
        };
      }

    } catch (error) {
      return {
        success: false,
        error: `Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Delete document from a single service only (for testing/debugging)
   * 
   * @param service - Which service to delete from ('pinecone', 'neo4j', 'firebase')
   * @param documentId - Document ID to delete
   * @param options - Service-specific options
   */
  static async deleteFromSingleService(
    service: 'pinecone' | 'neo4j' | 'firebase',
    documentId: string,
    options: {
      indexName?: string;
      namespace?: string;
      bucketName?: string;
    } = {}
  ): Promise<{ success: boolean; items_deleted: number; error?: string }> {
    
    try {
      const response = await fetch(`${this.DELETION_SERVICE_URL}/delete-${service}-only`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: documentId,
          ...options
        }),
        signal: AbortSignal.timeout(60000) // 1 minute timeout
      });

      const result = await response.json();

      if (response.ok) {
        console.log(`✅ ${service} deletion completed: ${result.items_deleted} items deleted`);
        return {
          success: result.success,
          items_deleted: result.items_deleted
        };
      } else {
        console.error(`❌ ${service} deletion failed:`, result);
        return {
          success: false,
          items_deleted: 0,
          error: result.error
        };
      }

    } catch (error) {
      return {
        success: false,
        items_deleted: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default DocumentDeletionService;