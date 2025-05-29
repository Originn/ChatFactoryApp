// src/app/api/pinecone/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from '@pinecone-database/pinecone';
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
  [key: string]: any;
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

class PineconeAPIService {
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

  static sanitizeIndexName(userInputName: string, userId: string): string {
    const sanitized = userInputName
      .toLowerCase()
      .replace(/[^a-z0-9-\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 30);
    
    const userPrefix = userId.substring(0, 8).toLowerCase();
    const fullName = `${userPrefix}-${sanitized}`.substring(0, 45);
    
    const finalName = fullName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    return finalName.length > 0 ? finalName : `${userPrefix}-kb`;
  }

  static generateIndexName(chatbotId: string): string {
    return chatbotId.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 45);
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

  static async listUserIndexes(userId: string) {
    try {
      const pc = this.getPineconeClient();
      const indexList = await pc.listIndexes();
      
      const userPrefix = userId.substring(0, 8);
      const userIndexes = indexList.indexes?.filter(index => 
        index.name?.startsWith(`${userPrefix}-`)
      ) || [];

      const indexesWithStats = await Promise.all(userIndexes.map(async (index) => {
        try {
          const stats = await pc.index(index.name!).describeIndexStats();
          const displayName = index.name!.replace(`${userPrefix}-`, '').replace(/-/g, ' ');
          return {
            name: index.name!,
            displayName: displayName,
            stats: stats
          };
        } catch (error) {
          const displayName = index.name!.replace(`${userPrefix}-`, '').replace(/-/g, ' ');
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

  static async createIndex(
    indexName: string,
    userId: string,
    dimension: number = 1536,
    metric: 'cosine' | 'euclidean' | 'dotproduct' = 'cosine'
  ) {
    try {
      const pc = this.getPineconeClient();

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
          createdBy: 'chatfactory-app',
          createdAt: new Date().toISOString()
        },
      });

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
    indexName: string,
    chatbotId: string,
    userId: string,
    documentName: string,
    documentType: string,
    textContent: string,
    source?: string
  ) {
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
    indexName: string,
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
    indexName: string,
    documentName: string,
    chatbotId?: string
  ) {
    try {
      const pc = this.getPineconeClient();

      if (!(await this.indexExists(indexName))) {
        return { success: true };
      }

      const index = pc.index(indexName);
      const filter: any = { documentName: { $eq: documentName } };
      
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

  static async deleteIndex(indexName: string) {
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

  static async getIndexStats(indexName: string) {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'sanitizeIndexName':
        const sanitized = PineconeAPIService.sanitizeIndexName(params.userInputName, params.userId);
        return NextResponse.json({ success: true, data: sanitized });

      case 'generateIndexName':
        const generated = PineconeAPIService.generateIndexName(params.chatbotId);
        return NextResponse.json({ success: true, data: generated });

      case 'isIndexNameAvailable':
        const available = !(await PineconeAPIService.indexExists(params.indexName));
        return NextResponse.json({ success: true, data: available });

      case 'listUserIndexes':
        const indexes = await PineconeAPIService.listUserIndexes(params.userId);
        return NextResponse.json(indexes);

      case 'indexExists':
        const exists = await PineconeAPIService.indexExists(params.indexName);
        return NextResponse.json({ success: true, data: exists });

      case 'createIndex':
        const createResult = await PineconeAPIService.createIndex(
          params.indexName,
          params.userId,
          params.dimension,
          params.metric
        );
        return NextResponse.json(createResult);

      case 'createIndexFromChatbotId':
        const indexName = PineconeAPIService.generateIndexName(params.chatbotId);
        const createFromChatbotResult = await PineconeAPIService.createIndex(
          indexName,
          params.userId,
          params.dimension,
          params.metric
        );
        return NextResponse.json(createFromChatbotResult);

      case 'generateEmbeddings':
        const embeddings = await PineconeAPIService.generateEmbeddings(params.textChunks);
        return NextResponse.json({ success: true, data: embeddings });

      case 'chunkText':
        const chunks = PineconeAPIService.chunkText(params.text, params.chunkSize, params.overlap);
        return NextResponse.json({ success: true, data: chunks });

      case 'uploadDocument':
        const uploadResult = await PineconeAPIService.uploadDocument(
          params.indexName,
          params.chatbotId,
          params.userId,
          params.documentName,
          params.documentType,
          params.textContent,
          params.source
        );
        return NextResponse.json(uploadResult);

      case 'queryVectors':
        const queryResult = await PineconeAPIService.queryVectors(
          params.indexName,
          params.queryText,
          params.topK,
          params.filter
        );
        return NextResponse.json(queryResult);

      case 'deleteDocument':
        const deleteDocResult = await PineconeAPIService.deleteDocument(
          params.indexName,
          params.documentName,
          params.chatbotId
        );
        return NextResponse.json(deleteDocResult);

      case 'deleteIndex':
        const deleteIndexResult = await PineconeAPIService.deleteIndex(params.indexName);
        return NextResponse.json(deleteIndexResult);

      case 'getIndexStats':
        const statsResult = await PineconeAPIService.getIndexStats(params.indexName);
        return NextResponse.json(statsResult);

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Pinecone API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
}
