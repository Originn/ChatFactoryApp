import { NextRequest, NextResponse } from 'next/server';
import { ImageOcrService } from '@/services/imageOcrService';
import { adminDb } from '@/lib/firebase/admin';

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

    // Validate image file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only JPG, PNG, and WEBP images are allowed.' 
      }, { status: 400 });
    }

    console.log(`🖼️ Processing image file: ${file.name} for chatbot: ${chatbotId}`);

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

    // Get embedding model configuration (defaults to Jina v4)
    const embeddingConfig = vectorstore.embeddingConfig || 'jina-embeddings-v4';
    const embeddingModel = typeof embeddingConfig === 'string' ? embeddingConfig : embeddingConfig.model || 'jina-embeddings-v4';

    // Construct image storage bucket name (same pattern as PDF service)
    const imageStorageBucket = `${firebaseProjectId}-chatbot-document-images`;

    console.log(`🧠 Using embedding model: ${embeddingModel}`);
    console.log(`📊 Target vectorstore: ${vectorstore.indexName}`);
    console.log(`🏷️ Pinecone namespace: '${chatbotData?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || vectorstore.namespace || ''}' ${!chatbotData?.name && !vectorstore.namespace ? '(will be auto-generated)' : ''}`);
    console.log(`🔒 Image access level: ${isPublic ? 'Public' : 'Private'}`);
    console.log(`🪣 Image storage bucket: ${imageStorageBucket}`);

    // Process image using ImageOcrService
    const healthResult = await ImageOcrService.checkHealth();
    if (!healthResult.success) {
      return NextResponse.json({
        success: false,
        error: `Image OCR service unavailable: ${healthResult.error}`,
        service: 'image-ocr-converter'
      }, { status: 503 });
    }

    const result = await ImageOcrService.processImage({
      file,
      chatbotId,
      userId,
      pineconeIndex: vectorstore.indexName,
      pineconeNamespace: chatbotData?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || vectorstore.namespace || '',
      isPublic,
      optimizeImage: true,
      imageStorageBucket  // Pass the bucket name to the service
    });

    if (result.success) {
      console.log(`✅ Image OCR processing completed successfully`);
      console.log(`📝 OCR extracted: ${result.wordCount} words`);
      console.log(`🔢 Vectors created: ${result.vectorCount}`);
      console.log(`🧠 Embedding: ${result.embeddingConfig || embeddingModel}`);
      console.log(`📊 Vectorstore: ${vectorstore.indexName}`);
      console.log(`🔒 Access level: ${isPublic ? 'Public' : 'Private'}`);

      return NextResponse.json({
        success: true,
        message: 'Image processed and OCR completed successfully',
        imageId: result.imageId,
        vectorCount: result.vectorCount,
        wordCount: result.wordCount,
        charCount: result.charCount,
        ocrProvider: result.ocrProvider,
        ocrModel: result.ocrModel,
        embeddingProvider: result.embeddingProvider,
        embeddingModel: result.embeddingModel,
        embeddingConfig: result.embeddingConfig,
        vectorstore: vectorstore.indexName,
        namespace: vectorstore.namespace || '',
        processingTime: result.processingTime,
        isPublic,
        dualEmbedding: true,
        note: 'Dual embedding strategy: OCR text + visual image content'
      });
    } else {
      console.error(`❌ Image OCR processing failed: ${result.error}`);
      return NextResponse.json({ 
        error: result.error || 'Failed to process image' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Image convert API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during image processing' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Health check for image OCR service
    const healthResult = await ImageOcrService.checkHealth();
    
    if (healthResult.success) {
      return NextResponse.json({
        success: true,
        status: healthResult.status,
        service: 'image-ocr-converter'
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: healthResult.error,
          service: 'image-ocr-converter'
        },
        { status: 503 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Health check failed',
        service: 'image-ocr-converter'
      },
      { status: 503 }
    );
  }
}