// src/services/imageOcrService.ts
import { PineconeService } from '@/services/pineconeService';
import { DatabaseService } from '@/services/databaseService';

const IMAGE_OCR_URL = process.env.IMAGE_OCR_URL || 'https://image-ocr-converter-931513743743.us-central1.run.app';

interface ImageProcessingRequest {
  file: File;
  chatbotId: string;
  userId: string;
  pineconeIndex: string;
  pineconeNamespace?: string;
  isPublic?: boolean;
  optimizeImage?: boolean;
  imageStorageUrl?: string;
  imageStorageBucket?: string;
}

interface ImageProcessingResponse {
  success: boolean;
  imageId?: string;
  vectorCount?: number;
  wordCount?: number;
  charCount?: number;
  ocrProvider?: string;
  ocrModel?: string;
  embeddingProvider?: string;
  embeddingModel?: string;
  embeddingConfig?: any;
  processingTime?: number;
  error?: string;
  dualEmbedding?: boolean;
}

interface HealthCheckResponse {
  success: boolean;
  status?: string;
  error?: string;
}

export class ImageOcrService {
  /**
   * Process image with OCR and dual embedding strategy
   */
  static async processImage(request: ImageProcessingRequest): Promise<ImageProcessingResponse> {
    try {
      console.log(`🖼️ Processing image: ${request.file.name}`);
      console.log(`📊 Target index: ${request.pineconeIndex}`);
      console.log(`🔍 OCR Provider: Gemini 2.0 Flash`);
      console.log(`🧠 Embedding Provider: Jina v4 (512D)`);
      console.log(`🎯 Dual Embedding: OCR text + visual content`);
      console.log(`⚙️ Image optimization: ${request.optimizeImage ? 'Enabled' : 'Disabled'}`);
      console.log(`🔒 Privacy setting: ${request.isPublic ? 'Public' : 'Private'}`);

      // Prepare form data for the container
      const formData = new FormData();
      formData.append('file', request.file);
      formData.append('pinecone_index', request.pineconeIndex);
      
      // Always send namespace parameter, even if empty (prevents default namespace usage)
      formData.append('pinecone_namespace', request.pineconeNamespace || '');
      
      formData.append('chatbot_id', request.chatbotId);
      formData.append('user_id', request.userId);
      formData.append('is_public', request.isPublic ? 'true' : 'false');
      formData.append('optimize_image', request.optimizeImage !== false ? 'true' : 'false');
      
      if (request.imageStorageUrl) {
        formData.append('image_storage_url', request.imageStorageUrl);
      }

      // Pass the bucket name for image upload
      if (request.imageStorageBucket) {
        formData.append('image_storage_bucket', request.imageStorageBucket);
      }

      console.log(`📡 Calling Image OCR container: ${IMAGE_OCR_URL}/process-image`);

      const response = await fetch(`${IMAGE_OCR_URL}/process-image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Image OCR service error (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log(`✅ Image OCR successful!`);
        console.log(`🆔 Image ID: ${result.imageId || 'Generated'}`);
        console.log(`📝 OCR Results: ${result.wordCount || 0} words extracted`);
        console.log(`🔢 Vectors: ${result.vectorCount || 2} created (text + image)`);
        console.log(`⏱️ Processing time: ${result.processingTime || 'N/A'}s`);
        console.log(`🧠 Embeddings: ${result.embeddingModel || 'jina-embeddings-v4'} (${result.dimensions || 512}D)`);
        console.log(`🔍 OCR Model: ${result.ocrModel || 'gemini-2.0-flash'}`);

        return {
          success: true,
          imageId: result.imageId,
          vectorCount: result.vectorCount || 2,
          wordCount: result.wordCount || 0,
          charCount: result.charCount || 0,
          ocrProvider: result.ocrProvider || 'gemini',
          ocrModel: result.ocrModel || 'gemini-2.0-flash',
          embeddingProvider: result.embeddingProvider || 'jina',
          embeddingModel: result.embeddingModel || 'jina-embeddings-v4',
          embeddingConfig: {
            provider: 'jina',
            model: 'jina-embeddings-v4',
            dimensions: result.dimensions || 512
          },
          processingTime: result.processingTime,
          dualEmbedding: result.dual_embedding !== false
        };
      } else {
        throw new Error(result.error || 'Image OCR processing failed');
      }

    } catch (error) {
      console.error(`❌ ImageOcrService.processImage error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Image OCR processing failed'
      };
    }
  }

  /**
   * Check health of image OCR service
   */
  static async checkHealth(): Promise<HealthCheckResponse> {
    try {
      console.log(`🔍 Checking Image OCR service health: ${IMAGE_OCR_URL}/health`);

      const response = await fetch(`${IMAGE_OCR_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.status === 'healthy') {
        console.log(`✅ Image OCR service is healthy`);
        return {
          success: true,
          status: result.status
        };
      } else {
        console.log(`⚠️ Image OCR service health check returned: ${JSON.stringify(result)}`);
        return {
          success: false,
          error: 'Service reports unhealthy status'
        };
      }

    } catch (error) {
      console.error(`❌ Image OCR service health check failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Health check request failed'
      };
    }
  }

  /**
   * List available OCR and embedding models
   */
  static async listModels(): Promise<any> {
    try {
      console.log(`📋 Fetching available models from: ${IMAGE_OCR_URL}/list-models`);

      const response = await fetch(`${IMAGE_OCR_URL}/list-models`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        console.log(`✅ Available models retrieved`);
        console.log(`🔍 OCR Models: ${result.models?.ocr_models?.length || 0}`);
        console.log(`🧠 Embedding Models: ${result.models?.embedding_models?.length || 0}`);
        
        return {
          success: true,
          models: result.models
        };
      } else {
        throw new Error(result.error || 'Failed to list models');
      }

    } catch (error) {
      console.error(`❌ ImageOcrService.listModels error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list models'
      };
    }
  }

  /**
   * Get default configuration for image OCR processing
   */
  static getDefaultConfig() {
    return {
      ocrProvider: 'gemini',
      ocrModel: 'gemini-2.0-flash',
      embeddingProvider: 'jina',
      embeddingModel: 'jina-embeddings-v4',
      dimensions: 512,
      dualEmbedding: true,
      optimizeImage: true,
      maxFileSize: '50MB',
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'],
      description: 'High-accuracy OCR with dual embedding strategy'
    };
  }

  /**
   * Validate image file before processing
   */
  static validateImageFile(file: File): { valid: boolean; error?: string } {
    const maxSizeBytes = 50 * 1024 * 1024; // 50MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        error: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max: 50MB)`
      };
    }

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Unsupported file type: ${file.type}. Supported: JPG, PNG, WEBP`
      };
    }

    return { valid: true };
  }
}