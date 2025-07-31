import { NextRequest, NextResponse } from 'next/server';
import { VideoService } from '@/services/videoService';
import { getEmbeddingDimensions } from '@/lib/embeddingModels';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const chatbotId = formData.get('chatbotId') as string;
    const userId = formData.get('userId') as string;
    const isPublic = formData.get('isPublic') === 'true';
    const language = formData.get('language') as string;
    const enableProcessing = formData.get('enableProcessing') === 'true';
    const useGPU = formData.get('useGPU') === 'true';

    if (!file || !chatbotId || !userId) {
      return NextResponse.json({ 
        error: 'Missing required fields: file, chatbotId, userId' 
      }, { status: 400 });
    }

    // Validate video file type
    const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.wmv'];
    const isVideoFile = videoExtensions.some(ext => 
      file.name.toLowerCase().endsWith(ext)
    );

    if (!isVideoFile) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only video files are allowed (MP4, AVI, MOV, MKV, WebM, WMV).' 
      }, { status: 400 });
    }

    console.log(`🎬 Processing video file: ${file.name} for chatbot: ${chatbotId}`);

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

    // Parse embedding model - for videos we use Jina v4 only
    let embeddingModel = aiConfig.embeddingModel;
    let dimensions: number | undefined;

    // Extract Jina model from embedding config
    if (aiConfig.embeddingModel.includes('/')) {
      const [provider, model] = aiConfig.embeddingModel.split('/', 2);
      if (provider === 'jina') {
        embeddingModel = model;
      } else {
        // Default to Jina v4 if not Jina provider specified
        embeddingModel = 'jina-embeddings-v4';
      }
    } else {
      // Auto-detect or default to Jina
      if (aiConfig.embeddingModel.startsWith('jina-')) {
        embeddingModel = aiConfig.embeddingModel;
      } else {
        embeddingModel = 'jina-embeddings-v4';
      }
    }

    // Get dimensions from centralized configuration
    dimensions = getEmbeddingDimensions(embeddingModel);

    console.log(`🔥 Using Firebase project: ${firebaseProjectId}`);
    console.log(`🔒 Video access level: ${isPublic ? 'Public' : 'Private'}`);
    console.log(`📊 Vectorstore: ${vectorstore.indexName}`);
    console.log(`🤖 Embedding: jina/${embeddingModel} (${dimensions}d)`);
    console.log(`🎙️ Language: ${language || 'auto-detect'}`);
    console.log(`🔄 3-Agent Processing: ${enableProcessing ? 'enabled' : 'disabled'}`);
    console.log(`⚡ GPU Processing: ${useGPU ? 'enabled (faster)' : 'disabled (CPU only)'}`);

    // Process the video file with the transcription service
    const result = await VideoService.processVideoDocument({
      file,
      chatbotId,
      userId,
      firebaseProjectId,
      isPublic,
      embeddingModel,
      dimensions,
      pineconeIndex: vectorstore.indexName,
      pineconeNamespace: chatbotData?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || undefined,
      language,
      enableProcessing,
      useGPU
    });

    if (result.success) {
      console.log(`✅ Video processing completed: ${result.vectorCount} vectors created`);
      
      return NextResponse.json({
        success: true,
        message: result.message,
        vectorCount: result.vectorCount,
        videoUrl: result.videoUrl,
        fileName: file.name,
        transcription: result.transcription,
        duration: result.duration,
        language: result.language,
        embeddingConfig: `jina/${embeddingModel}`,
        vectorstore: vectorstore.indexName
      });
    } else {
      console.error(`❌ Video processing failed:`, result.error);
      return NextResponse.json({ 
        error: result.error 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Video processing API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during video processing' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'cpu', 'gpu', or null for default
    
    let healthResult;
    let serviceName;
    
    if (type === 'cpu') {
      healthResult = await VideoService.healthCheckCPU();
      serviceName = 'video-transcriber-cpu';
    } else if (type === 'gpu') {
      healthResult = await VideoService.healthCheckGPU();
      serviceName = 'video-transcriber-gpu';
    } else {
      // Default health check - warm both CPU and GPU
      const [cpuResult, gpuResult] = await Promise.allSettled([
        VideoService.healthCheckCPU(),
        VideoService.healthCheckGPU()
      ]);
      
      const cpuSuccess = cpuResult.status === 'fulfilled' && cpuResult.value.success;
      const gpuSuccess = gpuResult.status === 'fulfilled' && gpuResult.value.success;
      
      return NextResponse.json({
        success: cpuSuccess || gpuSuccess,
        cpu: cpuSuccess ? 'healthy' : 'unavailable',
        gpu: gpuSuccess ? 'healthy' : 'unavailable',
        service: 'video-transcriber-both'
      });
    }
    
    if (healthResult.success) {
      return NextResponse.json({
        success: true,
        status: healthResult.status,
        service: serviceName
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: healthResult.error,
          service: serviceName
        },
        { status: 503 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Health check failed',
        service: 'video-transcriber'
      },
      { status: 503 }
    );
  }
}
