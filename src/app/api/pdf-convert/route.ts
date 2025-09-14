import { NextRequest, NextResponse } from 'next/server';
import { PDFService } from '@/services/pdfService';
import { getEmbeddingDimensions } from '@/lib/embeddingModels';
import { adminDb } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const chatbotId = formData.get('chatbotId') as string;
    const userId = formData.get('userId') as string;
    const isPublic = formData.get('isPublic') === 'true';

    if (!file || !chatbotId || !userId) {
      return NextResponse.json({ 
        error: 'Missing required fields: file, chatbotId, userId' 
      }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ 
        error: 'Invalid file type. Only .pdf files are allowed.' 
      }, { status: 400 });
    }

    console.log(`📄 Processing PDF file: ${file.name} for chatbot: ${chatbotId}`);

    // 🔑 CRITICAL: Generate document_id for traceability and deletion
    const document_id = uuidv4();
    console.log(`📋 Generated document_id: ${document_id}`);

    // Get chatbot configuration from database
    const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
    if (!chatbotDoc.exists) {
      return NextResponse.json({ 
        error: 'Chatbot not found' 
      }, { status: 404 });
    }

    const chatbotData = chatbotDoc.data();
    const firebaseProjectId = chatbotData?.firebaseProjectId || chatbotData?.deployment?.firebaseProjectId;
    
    if (!firebaseProjectId) {
      return NextResponse.json({ 
        error: 'Firebase project not configured for this chatbot' 
      }, { status: 404 });
    }

    // Get vectorstore configuration
    const vectorstore = chatbotData?.vectorstore;
    if (!vectorstore || !vectorstore.indexName) {
      return NextResponse.json({ 
        error: 'Vectorstore not configured for this chatbot' 
      }, { status: 404 });
    }

    // Get embedding model configuration
    const aiConfig = chatbotData?.aiConfig;
    if (!aiConfig || !aiConfig.embeddingModel) {
      return NextResponse.json({ 
        error: 'AI configuration not found for this chatbot' 
      }, { status: 404 });
    }

    // Parse embedding model to extract provider and model name
    // Expected format: "openai/text-embedding-3-large" or "text-embedding-3-large"
    let embeddingProvider = 'openai'; // default
    let embeddingModel = aiConfig.embeddingModel;
    let dimensions: number | undefined;

    if (aiConfig.embeddingModel.includes('/')) {
      [embeddingProvider, embeddingModel] = aiConfig.embeddingModel.split('/', 2);
    } else {
      // Auto-detect provider based on model name
      if (aiConfig.embeddingModel.startsWith('jina-')) {
        embeddingProvider = 'jina';
      } else if (aiConfig.embeddingModel.startsWith('cohere-') || aiConfig.embeddingModel.startsWith('embed-')) {
        embeddingProvider = 'cohere';
      } else if (aiConfig.embeddingModel.startsWith('hf-')) {
        embeddingProvider = 'huggingface';
      } else if (aiConfig.embeddingModel.startsWith('azure-')) {
        embeddingProvider = 'azure';
      }
    }

    // ✅ Get dimensions from centralized configuration
    dimensions = getEmbeddingDimensions(embeddingModel);

    // Get multimodal flag from AI config
    const multimodal = aiConfig.multimodal || false;

    // Construct image storage bucket name
    const imageStorageBucket = `${firebaseProjectId}-chatbot-document-images`;

    console.log(`🔥 Using Firebase project: ${firebaseProjectId}`);
    console.log(`🔒 PDF access level: ${isPublic ? 'Public' : 'Private'}`);
    console.log(`📊 Vectorstore: ${vectorstore.indexName}`);
    console.log(`🤖 Embedding: ${embeddingProvider}/${embeddingModel} (${dimensions}d)`);
    console.log(`🎨 Multimodal: ${multimodal ? 'enabled' : 'disabled'}`);
    console.log(`🎯 Dual Embedding: Always enabled (default strategy)`);
    console.log(`🪣 Image storage bucket: ${imageStorageBucket}`);

    // Process the PDF file with the cloud converter
    const result = await PDFService.processPDFDocument({
      file,
      chatbotId,
      userId,
      document_id, // 🔑 CRITICAL: Pass document_id for traceability
      firebaseProjectId,
      isPublic,
      embeddingProvider: embeddingProvider as any,
      embeddingModel,
      multimodal,
      dimensions,
      pineconeIndex: vectorstore.indexName,
      pineconeNamespace: chatbotData?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || undefined,
      imageStorageBucket
    });

    if (result.success) {
      console.log(`✅ PDF processing completed: ${result.vectorCount} vectors created`);
      
      return NextResponse.json({
        success: true,
        message: result.message,
        document_id, // 🔑 CRITICAL: Return document_id for frontend tracking
        vectorCount: result.vectorCount,
        pdfUrl: result.pdfUrl,
        fileName: file.name,
        embeddingConfig: `${embeddingProvider}/${embeddingModel}`,
        vectorstore: vectorstore.indexName
      });
    } else {
      console.error(`❌ PDF processing failed:`, result.error);
      return NextResponse.json({ 
        error: result.error 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('PDF conversion API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during PDF processing' 
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Health check for PDF converter service
    const healthResult = await PDFService.healthCheck();
    
    if (healthResult.success) {
      return NextResponse.json({
        success: true,
        status: healthResult.status,
        service: 'pdf-converter'
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: healthResult.error,
          service: 'pdf-converter'
        },
        { status: 503 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Health check failed',
        service: 'pdf-converter'
      },
      { status: 503 }
    );
  }
}