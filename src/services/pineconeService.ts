// src/services/pineconeService.ts
import { Pinecone } from '@pinecone-database/pinecone';
import { getEmbeddingDimensions } from '@/lib/embeddingModels';
import OpenAI from 'openai';

interface DocumentMetadata {
  chatbotId: string;
  userId: string;
  documentName: string;
  documentType: string;
  chunkIndex: number;
  totalChunks: number;
  uploadedAt: string;
  source?: string;
  isPublic?: boolean; // 🔒 SECURITY: Privacy flag to control chatbot access
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
  private static pinecone: Pinecone | null = null;
  private static openai: OpenAI | null = null;

  private static getPineconeClient(): Pinecone {
    if (!this.pinecone) {
      this.pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    }
    return this.pinecone;
  }

  private static getOpenAIClient(): OpenAI {
    if (!this.openai) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
    }
    return this.openai;
  }

  // Generate a valid Pinecone index name from user input
  static sanitizeIndexName(userInputName: string, userId: string): string {
    // Pinecone index names must be lowercase, alphanumeric with hyphens, 1-45 chars
    const sanitized = userInputName
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '') // Remove invalid chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .substring(0, 30); // Leave room for user prefix
    
    // Add user prefix to avoid conflicts between users - MUST BE LOWERCASE
    const userPrefix = userId.substring(0, 8).toLowerCase();
    const fullName = `${userPrefix}-${sanitized}`.substring(0, 45);
    
    // Final validation - ensure it meets Pinecone requirements
    const finalName = fullName
      .toLowerCase() // Ensure all lowercase
      .replace(/[^a-z0-9-]/g, '') // Remove any remaining invalid chars
      .replace(/-+/g, '-') // Clean up multiple hyphens
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    // Ensure minimum length
    return finalName.length > 0 ? finalName : `${userPrefix}-kb`;
  }

  // Backward compatibility: Generate index name from chatbotId
  static generateIndexName(chatbotId: string): string {
    return chatbotId.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 45);
  }

  // Validate if a name is available
  static async isIndexNameAvailable(indexName: string): Promise<boolean> {
    return !(await this.indexExists(indexName));
  }

  // List all indexes owned by a user
  static async listUserIndexes(userId: string): Promise<{ success: boolean; indexes: Array<{name: string, displayName: string, stats?: any}>; error?: string }> {
    try {
      const pc = this.getPineconeClient();
      const indexList = await pc.listIndexes();
      
      const userPrefix = userId.substring(0, 8).toLowerCase(); // ✅ Force lowercase
      const userIndexes = indexList.indexes?.filter(index => 
        index.name?.toLowerCase().startsWith(`${userPrefix}-`) // ✅ Case insensitive comparison
      ) || [];

      const indexesWithStats = await Promise.all(userIndexes.map(async (index) => {
        try {
          const stats = await pc.index(index.name!).describeIndexStats();
          const displayName = index.name!.replace(new RegExp(`^${userPrefix}-`, 'i'), '').replace(/-/g, ' '); // ✅ Case insensitive replacement
          return {
            name: index.name!,
            displayName: displayName,
            stats: stats
          };
        } catch (error) {
          const displayName = index.name!.replace(new RegExp(`^${userPrefix}-`, 'i'), '').replace(/-/g, ' '); // ✅ Case insensitive replacement
          return {
            name: index.name!,
            displayName: displayName,
            stats: null
          };
        }
      }));

      return { success: true, indexes: indexesWithStats };
    } catch (error) {
      return { 
        success: false, 
        indexes: [],
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // List all indexes owned by a user with dimensions and compatibility info
  static async listUserIndexesWithDimensions(userId: string, requiredEmbeddingModel?: string): Promise<{ 
    success: boolean; 
    indexes: Array<{
      name: string, 
      displayName: string, 
      dimensions?: number,
      embeddingModel?: string,
      isCompatible: boolean,
      vectorCount?: number,
      stats?: any
    }>; 
    error?: string 
  }> {
    try {
      const pc = this.getPineconeClient();
      const indexList = await pc.listIndexes();
      
      const userPrefix = userId.substring(0, 8).toLowerCase(); // ✅ Force lowercase
      
      const userIndexes = indexList.indexes?.filter(index => 
        index.name?.toLowerCase().startsWith(`${userPrefix}-`) // ✅ Case insensitive comparison
      ) || [];

      const indexesWithDetails = await Promise.all(userIndexes.map(async (index) => {
        try {
          // Get both stats and index details (including tags)
          const [stats, indexDetails] = await Promise.all([
            pc.index(index.name!).describeIndexStats(),
            pc.describeIndex(index.name!)
          ]);
          
          const displayName = index.name!.replace(new RegExp(`^${userPrefix}-`, 'i'), '').replace(/-/g, ' '); // ✅ Case insensitive replacement
          
          // Get dimensions from index configuration
          const dimensions = index.dimension;
          
          // Get embedding model from tags
          const embeddingModel = indexDetails.tags?.embeddingModel || 'unknown';
          
          // Check compatibility based on embedding model (not just dimensions)
          const isCompatible = requiredEmbeddingModel ? embeddingModel === requiredEmbeddingModel : true;
          
          // Better vector count extraction - check multiple possible locations
          let vectorCount = 0;
          
          // Try totalRecordCount first (newer API)
          if (stats?.totalRecordCount) {
            vectorCount = stats.totalRecordCount;
          } 
          // Sum up records from all namespaces
          else if (stats?.namespaces) {
            vectorCount = Object.values(stats.namespaces).reduce((total: number, namespace: any) => {
              return total + (namespace.recordCount || namespace.vectorCount || 0);
            }, 0);
          }
          
          return {
            name: index.name!,
            displayName: displayName,
            dimensions: dimensions,
            embeddingModel: embeddingModel,
            isCompatible: isCompatible,
            vectorCount: vectorCount,
            stats: stats
          };
        } catch (error) {
          console.error('Error processing index:', index.name, error);
          const displayName = index.name!.replace(new RegExp(`^${userPrefix}-`, 'i'), '').replace(/-/g, ' '); // ✅ Case insensitive replacement
          
          // Try to get basic stats even if there's an error
          let vectorCount = 0;
          let embeddingModel = 'unknown';
          
          try {
            const [basicStats, indexDetails] = await Promise.all([
              pc.index(index.name!).describeIndexStats(),
              pc.describeIndex(index.name!)
            ]);
            
            embeddingModel = indexDetails.tags?.embeddingModel || 'unknown';
            
            // Try totalRecordCount first (newer API)
            if (basicStats?.totalRecordCount) {
              vectorCount = basicStats.totalRecordCount;
            } 
            // Sum up records from all namespaces
            else if (basicStats?.namespaces) {
              vectorCount = Object.values(basicStats.namespaces).reduce((total: number, namespace: any) => {
                return total + (namespace.recordCount || namespace.vectorCount || 0);
              }, 0);
            }
          } catch (retryError) {
            console.error('Failed to get basic stats on retry:', retryError);
          }
          
          return {
            name: index.name!,
            displayName: displayName,
            dimensions: index.dimension,
            embeddingModel: embeddingModel,
            isCompatible: requiredEmbeddingModel ? embeddingModel === requiredEmbeddingModel : true,
            vectorCount: vectorCount, // Use the calculated vectorCount
            stats: null
          };
        }
      }));

      return { success: true, indexes: indexesWithDetails };
    } catch (error) {
      console.error('Error in listUserIndexesWithDimensions:', error);
      return { 
        success: false, 
        indexes: [],
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  static async indexExists(indexName: string): Promise<boolean> {
    try {
      const pc = this.getPineconeClient();
      const indexList = await pc.listIndexes();
      return indexList.indexes?.some(index => index.name === indexName) || false;
    } catch {
      return false;
    }
  }

  static async createIndex(
    indexName: string, // Now accepts custom name instead of chatbotId
    userId: string,
    embeddingModel: string, // ✅ Now requires embedding model to get correct dimensions
    metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine'
  ): Promise<{ success: boolean; indexName: string; error?: string }> {
    try {
      const pc = this.getPineconeClient();
      
      // ✅ Get dimensions based on embedding model
      const dimension = getEmbeddingDimensions(embeddingModel);
      console.log(`🔢 Creating index with ${dimension} dimensions for model: ${embeddingModel}`);

      if (await this.indexExists(indexName)) {
        console.log(`✅ Index ${indexName} already exists`);
        return { success: true, indexName };
      }

      console.log(`🗄️ Creating Pinecone index: ${indexName}`);

      await pc.createIndex({
        name: indexName,
        dimension,
        metric,
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
        tags: { 
          userId: userId,
          embeddingModel: embeddingModel, // Store the embedding model used
          createdBy: 'chatfactory-app',
          createdAt: new Date().toISOString()
        },
      });

      // Wait for index to be ready with better logging
      let attempts = 0;
      const maxAttempts = 30;
      
      console.log(`⏳ Waiting for index ${indexName} to be ready...`);
      
      while (attempts < maxAttempts) {
        try {
          const stats = await pc.index(indexName).describeIndexStats();
          if (stats) {
            console.log(`✅ Index ${indexName} is ready after ${attempts + 1} attempts`);
          break;
          }
        } catch (error) {
          console.log(`⏳ Index not ready yet, attempt ${attempts + 1}/${maxAttempts}...`);
        }
        
          await new Promise(resolve => setTimeout(resolve, 10000));
          attempts++;
        }

      if (attempts >= maxAttempts) {
        return { 
          success: false, 
          indexName, 
          error: `Index creation timed out after ${maxAttempts * 10} seconds` 
        };
      }

      console.log(`✅ Successfully created and verified Pinecone index: ${indexName}`);
      return { success: true, indexName };

    } catch (error) {
      console.error('❌ Error creating Pinecone index:', error);
      return { 
        success: false, 
        indexName, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Backward compatibility: Create index from chatbotId
  static async createIndexFromChatbotId(
    chatbotId: string,
    userId: string,
    embeddingModel: string = 'text-embedding-3-small', // ✅ Now uses embeddingModel instead of dimension
    metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine'
  ): Promise<{ success: boolean; indexName: string; error?: string }> {
    const indexName = this.generateIndexName(chatbotId);
    return this.createIndex(indexName, userId, embeddingModel, metric);
  }

  static async generateEmbeddings(textChunks: string[]): Promise<number[][]> {
    const openai = this.getOpenAIClient();
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: textChunks,
    });
    return response.data.map(embedding => embedding.embedding);
  }

  static chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end).trim());
      if (end >= text.length) break;
      start = end - overlap;
    }
    return chunks.filter(chunk => chunk.length > 0);
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
    try {
      const pc = this.getPineconeClient();

      if (!(await this.indexExists(indexName))) {
        return { 
          success: false, 
          vectorCount: 0, 
          error: `Index ${indexName} does not exist. Please create it first.` 
        };
      }

      const chunks = this.chunkText(textContent);
      const embeddings = await this.generateEmbeddings(chunks);

      const vectors: VectorRecord[] = chunks.map((chunk, index) => ({
        id: `${chatbotId}-${documentName}-${index}`,
        values: embeddings[index],
        metadata: {
          chatbotId, userId, documentName, documentType,
          chunkIndex: index, totalChunks: chunks.length,
          uploadedAt: new Date().toISOString(),
          source: source || documentName,
        },
      }));

      const index = pc.index(indexName);
      const batchSize = 100;
      let uploadedCount = 0;

      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        await index.upsert(batch);
        uploadedCount += batch.length;
      }

      return { success: true, vectorCount: uploadedCount };
    } catch (error) {
      return { 
        success: false, vectorCount: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  static async queryVectors(
    indexName: string, // Changed from chatbotId to indexName
    queryText: string,
    topK: number = 10,
    filter?: Record<string, any>
  ) {
    try {
      const pc = this.getPineconeClient();
      const [queryEmbedding] = await this.generateEmbeddings([queryText]);
      
      const index = pc.index(indexName);
      const queryResponse = await index.query({
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
        filter,
      });

      return {
        success: true,
        matches: queryResponse.matches.map(match => ({
          id: match.id,
          score: match.score || 0,
          metadata: match.metadata as DocumentMetadata,
        })),
      };
    } catch (error) {
      return {
        success: false,
        matches: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async deleteDocument(
    indexName: string, // Changed from chatbotId to indexName
    documentName: string,
    chatbotId?: string // Optional for filtering
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const pc = this.getPineconeClient();

      if (!(await this.indexExists(indexName))) {
        return { success: true };
      }

      const index = pc.index(indexName);
      const filter: any = { documentName: { $eq: documentName } };
      
      // Add chatbot filter if provided
      if (chatbotId) {
        filter.chatbotId = { $eq: chatbotId };
      }

      await index.deleteMany({ filter });

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  static async deleteIndex(indexName: string): Promise<{ success: boolean; error?: string }> {
    try {
      const pc = this.getPineconeClient();
      if (await this.indexExists(indexName)) {
        console.log(`🗑️ Deleting Pinecone index: ${indexName}`);
        await pc.deleteIndex(indexName);
        console.log(`✅ Successfully deleted Pinecone index: ${indexName}`);
      } else {
        console.log(`ℹ️ Index ${indexName} does not exist, skipping deletion`);
      }
      return { success: true };
    } catch (error) {
      console.error(`❌ Error deleting Pinecone index:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  static async getIndexStats(indexName: string): Promise<{ success: boolean; stats?: any; error?: string }> {
    try {
      const pc = this.getPineconeClient();
      
      if (!(await this.indexExists(indexName))) {
        return { success: true, stats: null };
      }

      const index = pc.index(indexName);
      const stats = await index.describeIndexStats();
      
      return { success: true, stats };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

export { PineconeService };
export type { DocumentMetadata, VectorRecord };
