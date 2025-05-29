// src/services/pineconeService.ts
interface DocumentMetadata {
  chatbotId: string;
  userId: string;
  documentName: string;
  documentType: string;
  chunkIndex: number;
  totalChunks: number;
  uploadedAt: string;
  source?: string;
  [key: string]: any; // Allow additional metadata fields
}

interface VectorRecord {
  id: string;
  values: number[];
  metadata: DocumentMetadata;
  sparseValues?: {
    indices: number[];
    values: number[];
  };
}

class PineconeService {
  private static async makeRequest(action: string, params: any = {}) {
    const response = await fetch('/api/pinecone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...params }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Generate a valid Pinecone index name from user input
  static async sanitizeIndexName(userInputName: string, userId: string): Promise<string> {
    const result = await this.makeRequest('sanitizeIndexName', { userInputName, userId });
    return result.data;
  }

  // Backward compatibility: Generate index name from chatbotId
  static async generateIndexName(chatbotId: string): Promise<string> {
    const result = await this.makeRequest('generateIndexName', { chatbotId });
    return result.data;
  }

  // Validate if a name is available
  static async isIndexNameAvailable(indexName: string): Promise<boolean> {
    const result = await this.makeRequest('isIndexNameAvailable', { indexName });
    return result.data;
  }

  // List all indexes owned by a user
  static async listUserIndexes(userId: string): Promise<{ success: boolean; indexes: Array<{name: string, displayName: string, stats?: any}>; error?: string }> {
    return this.makeRequest('listUserIndexes', { userId });
  }

  static async indexExists(indexName: string): Promise<boolean> {
    const result = await this.makeRequest('indexExists', { indexName });
    return result.data;
  }

  static async createIndex(
    indexName: string, // Now accepts custom name instead of chatbotId
    userId: string,
    dimension: number = 1536,
    metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine'
  ): Promise<{ success: boolean; indexName: string; error?: string }> {
    return this.makeRequest('createIndex', { indexName, userId, dimension, metric });
  }

  // Backward compatibility: Create index from chatbotId
  static async createIndexFromChatbotId(
    chatbotId: string,
    userId: string,
    dimension: number = 1536,
    metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine'
  ): Promise<{ success: boolean; indexName: string; error?: string }> {
    return this.makeRequest('createIndexFromChatbotId', { chatbotId, userId, dimension, metric });
  }

  static async generateEmbeddings(textChunks: string[]): Promise<number[][]> {
    const result = await this.makeRequest('generateEmbeddings', { textChunks });
    return result.data;
  }

  static async chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): Promise<string[]> {
    const result = await this.makeRequest('chunkText', { text, chunkSize, overlap });
    return result.data;
  }

  static async uploadDocument(
    indexName: string, // Changed from chatbotId to indexName
    chatbotId: string, // Still need for metadata
    userId: string,
    documentName: string,
    documentType: string,
    textContent: string,
    source?: string
  ): Promise<{ success: boolean; vectorCount: number; error?: string }> {
    return this.makeRequest('uploadDocument', {
      indexName,
      chatbotId,
      userId,
      documentName,
      documentType,
      textContent,
      source
    });
  }

  static async queryVectors(
    indexName: string, // Changed from chatbotId to indexName
    queryText: string,
    topK: number = 10,
    filter?: Record<string, any>
  ) {
    return this.makeRequest('queryVectors', { indexName, queryText, topK, filter });
  }

  static async deleteDocument(
    indexName: string, // Changed from chatbotId to indexName
    documentName: string,
    chatbotId?: string // Optional for filtering
  ): Promise<{ success: boolean; error?: string }> {
    return this.makeRequest('deleteDocument', { indexName, documentName, chatbotId });
  }

  static async deleteIndex(indexName: string): Promise<{ success: boolean; error?: string }> {
    return this.makeRequest('deleteIndex', { indexName });
  }

  static async getIndexStats(indexName: string): Promise<{ success: boolean; stats?: any; error?: string }> {
    return this.makeRequest('getIndexStats', { indexName });
  }
}

export { PineconeService };
export type { DocumentMetadata, VectorRecord };
