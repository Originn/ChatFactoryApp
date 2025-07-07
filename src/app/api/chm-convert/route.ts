import { NextRequest, NextResponse } from 'next/server';
import { CHMService } from '@/services/chmService';
import { DatabaseService } from '@/services/databaseService';
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

    if (!file.name.toLowerCase().endsWith('.chm')) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only .chm files are allowed.' 
      }, { status: 400 });
    }

    console.log(`📄 Processing CHM file: ${file.name} for chatbot: ${chatbotId}`);

    // Get chatbot configuration from database (same as PDF)
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

    // Get vectorstore configuration (same as PDF)
    const vectorstore = chatbotData?.vectorstore;
    if (!vectorstore || !vectorstore.indexName) {
      console.log(`⚠️ No vectorstore configured - using legacy CHM conversion (PDF only)`);
      
      // Legacy mode: CHM → PDF only (no embeddings)
      const result = await CHMService.processCHMDocument(
        file,
        chatbotId,
        userId,
        firebaseProjectId,
        isPublic
      );

      if (result.success) {
        console.log(`✅ Legacy CHM processing completed: ${result.vectorCount || 0} vectors created`);
        
        return NextResponse.json({
          success: true,
          message: result.message,
          vectorCount: result.vectorCount || 0,
          pdfUrl: result.pdfUrl,
          fileName: file.name.replace('.chm', '.pdf'),
          mode: 'legacy'
        });
      } else if (result.jobId) {
        // Legacy job is also queued/processing - return job info for polling
        console.log(`⏳ Legacy CHM processing queued/in-progress: ${result.status} (Job ID: ${result.jobId})`);
        
        return NextResponse.json({
          success: false,
          processing: true,
          jobId: result.jobId,
          status: result.status,
          message: result.message,
          fileName: file.name.replace('.chm', '.pdf'),
          mode: 'legacy'
        });
      } else {
        console.error(`❌ Legacy CHM processing failed:`, result.error);
        return NextResponse.json({ 
          error: result.error 
        }, { status: 500 });
      }
    }

    // Get embedding model configuration (same as PDF)
    const aiConfig = chatbotData?.aiConfig;
    if (!aiConfig || !aiConfig.embeddingModel) {
      return NextResponse.json({ 
        error: 'AI configuration not found for this chatbot' 
      }, { status: 404 });
    }

    // Parse embedding model to extract provider and model name (same as PDF)
    let embeddingProvider = 'openai'; // default
    let embeddingModel = aiConfig.embeddingModel;
    let dimensions: number | undefined;

    if (aiConfig.embeddingModel.includes('/')) {
      [embeddingProvider, embeddingModel] = aiConfig.embeddingModel.split('/', 2);
    }

    // Set dimensions based on known models (same as PDF)
    const modelDimensions: Record<string, number> = {
      'text-embedding-3-large': 3072,
      'text-embedding-3-small': 1536,
      'text-embedding-ada-002': 1536,
      'embed-multilingual-v3.0': 1024,
      'embed-english-v3.0': 1024,
      'voyage-large-2': 1536,
      'voyage-code-2': 1536,
      'voyage-3': 1024,
      'voyage-code-3': 1024,
      'voyage-finance-3': 1024
    };

    dimensions = modelDimensions[embeddingModel] || vectorstore.dimension;

    console.log(`🔥 Using Firebase project: ${firebaseProjectId}`);
    console.log(`🔒 CHM access level: ${isPublic ? 'Public' : 'Private'}`);
    console.log(`📊 Vectorstore: ${vectorstore.indexName}`);
    console.log(`🤖 Embedding: ${embeddingProvider}/${embeddingModel} (${dimensions}d)`);

    // Process the CHM file with the enhanced converter
    const result = await CHMService.processCHMDocument(
      file,
      chatbotId,
      userId,
      firebaseProjectId,
      isPublic,
      // Pass embedding configuration
      embeddingProvider as any,
      embeddingModel,
      dimensions,
      vectorstore.indexName,
      chatbotData?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || undefined
    );

    // Handle different result statuses
    if (result.success) {
      // Job completed successfully
      console.log(`✅ Enhanced CHM processing completed: ${result.vectorCount} vectors created`);
      
      // 🔧 FIX: Save document metadata to database so it appears in Documents tab
      try {
        const pdfMetadataResult = await DatabaseService.createPDFMetadata({
          userId,
          chatbotId,
          originalFileName: file.name,
          pdfFileName: file.name.replace('.chm', '.pdf'),
          isPublic,
          firebaseStoragePath: `chm-external:${result.pdfUrl}`, // Special path for CHM external URLs
          firebaseProjectId,
          ...(result.pdfUrl && { publicUrl: result.pdfUrl }), // Set publicUrl for access
          fileSize: file.size, // Use original CHM file size
          status: 'completed',
          vectorCount: result.vectorCount
        });

        if (pdfMetadataResult.success) {
          console.log(`✅ Saved CHM document metadata to database: ${pdfMetadataResult.pdfId}`);
        } else {
          console.warn(`⚠️ Failed to save CHM document metadata: ${pdfMetadataResult.error}`);
        }
      } catch (metadataError) {
        console.error('❌ Error saving CHM document metadata:', metadataError);
      }
      
      return NextResponse.json({
        success: true,
        message: result.message,
        vectorCount: result.vectorCount,
        pdfUrl: result.pdfUrl,
        fileName: file.name.replace('.chm', '.pdf'),
        embeddingConfig: `${embeddingProvider}/${embeddingModel}`,
        vectorstore: vectorstore.indexName,
        mode: result.mode || 'enhanced_complete' // ✅ Use mode from CHM service result
      });
    } else if (result.jobId) {
      // Job is queued or processing - return job info for polling
      console.log(`⏳ CHM processing queued/in-progress: ${result.status} (Job ID: ${result.jobId})`);
      
      return NextResponse.json({
        success: false,
        processing: true,
        jobId: result.jobId,
        status: result.status,
        message: result.message,
        queuePosition: result.queuePosition,
        estimatedTimeSeconds: result.estimatedTimeSeconds,
        fileName: file.name.replace('.chm', '.pdf'),
        embeddingConfig: `${embeddingProvider}/${embeddingModel}`,
        vectorstore: vectorstore.indexName,
        mode: 'enhanced'
      });
    } else {
      // Job failed
      console.error(`❌ Enhanced CHM processing failed:`, result.error);
      return NextResponse.json({ 
        error: result.error 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('CHM conversion API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during CHM processing' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (jobId) {
      // Poll job completion (use enhanced polling method)
      const result = await CHMService.pollJobCompletion(jobId);
      
      if (result.success) {
        // Job completed successfully
        return NextResponse.json({
          success: true,
          status: 'completed',
          message: result.message,
          vectorCount: result.vectorCount,
          pdfUrl: result.pdfUrl,
          completed: true
        });
      } else if (result.jobId) {
        // Job still processing
        return NextResponse.json({
          success: false,
          processing: true,
          jobId: result.jobId,
          status: result.status,
          message: result.message,
          completed: false
        });
      } else {
        // Job failed
        return NextResponse.json({
          success: false,
          error: result.error,
          status: 'failed',
          completed: true
        });
      }
    } else {
      // Health check for CHM converter service (NEW!)
      const healthResult = await CHMService.healthCheck();
      
      if (healthResult.success) {
        return NextResponse.json({
          success: true,
          status: healthResult.status,
          service: 'chm-converter'
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: healthResult.error,
            service: 'chm-converter'
          },
          { status: 503 }
        );
      }
    }

  } catch (error) {
    console.error('CHM API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during CHM API call' 
    }, { status: 500 });
  }
}
