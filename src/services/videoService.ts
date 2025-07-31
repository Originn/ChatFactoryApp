import { adminStorage } from '@/lib/firebase/admin';
import { DatabaseService } from '@/services/databaseService';

const VIDEO_TRANSCRIBER_URL = process.env.VIDEO_TRANSCRIBER_URL || 'https://video-transcriber-931513743743.us-central1.run.app';

interface VideoProcessingRequest {
  file: File;
  chatbotId: string;
  userId: string;
  firebaseProjectId: string;
  isPublic?: boolean;
  // Embedding configuration
  embeddingModel: string;
  dimensions?: number;
  // Pinecone configuration
  pineconeIndex: string;
  pineconeNamespace?: string;
  // Language settings
  language?: string;
  enableProcessing?: boolean;
  useGPU?: boolean;
}

interface VideoTranscriptionResult {
  success: boolean;
  transcription?: string;
  timestamped_transcript?: string;
  processed_transcript?: string;
  duration?: number;
  language?: string;
  file_size?: number;
  processing_time?: number;
  video_url?: string;
  video_name?: string;
  // Pinecone results
  pinecone_enabled?: boolean;
  vector_count?: number;
  chunks_created?: number;
  pinecone_index?: string;
  pinecone_namespace?: string;
  embedding_model?: string;
  pinecone_error?: string;
  error?: string;
}

interface VideoProcessingResult {
  success: boolean;
  message?: string;
  vectorCount?: number;
  videoUrl?: string;
  transcription?: string;
  duration?: number;
  language?: string;
  error?: string;
}

export class VideoService {
  
  /**
   * Store video in Firebase Storage with public/private access control
   */
  static async storeVideoInFirebase(
    videoBuffer: Buffer, 
    chatbotId: string, 
    userId: string,
    fileName: string,
    firebaseProjectId: string,
    isPublic: boolean = false
  ): Promise<{ success: boolean; storagePath?: string; publicUrl?: string; error?: string }> {
    try {
      const { Storage } = require('@google-cloud/storage');
      
      const credentials = {
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        project_id: process.env.FIREBASE_PROJECT_ID,
      };
      
      const projectSpecificStorage = new Storage({
        projectId: firebaseProjectId,
        credentials: credentials
      });
      
      console.log(`📹 Storing video in project: ${firebaseProjectId}`);
      
      // Use existing chatbot-specific buckets
      const chatbotBucketName = `${firebaseProjectId}-chatbot-documents`;
      let bucket;
      
      try {
        bucket = projectSpecificStorage.bucket(chatbotBucketName);
        await bucket.getMetadata();
        console.log(`✅ Using existing chatbot documents bucket: ${chatbotBucketName}`);
        
      } catch (bucketError) {
        console.log(`⚠️ Chatbot documents bucket not found, trying fallback bucket names...`);
        
        const fallbackBuckets = [
          `${firebaseProjectId}.appspot.com`,
          firebaseProjectId,
          `${firebaseProjectId}-default-rtdb`,
          `${firebaseProjectId}-storage`,
          `${firebaseProjectId}-firebase-chatbot-documents`,
        ];
        
        let bucketFound = false;
        for (const bucketName of fallbackBuckets) {
          try {
            bucket = projectSpecificStorage.bucket(bucketName);
            await bucket.getMetadata();
            console.log(`✅ Found working fallback bucket: ${bucketName}`);
            bucketFound = true;
            break;
          } catch (err) {
            console.log(`❌ Fallback bucket ${bucketName} not accessible`);
          }
        }
        
        if (!bucketFound) {
          throw new Error(`No accessible storage buckets found in project ${firebaseProjectId}`);
        }
      }
      
      // Create file path based on privacy setting
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      let filePath: string;
      
      if (isPublic) {
        filePath = `public_videos/${chatbotId}/${sanitizedFileName}`;
      } else {
        filePath = `private_videos/${userId}/${chatbotId}/${sanitizedFileName}`;
      }
      
      const file = bucket.file(filePath);
      
      // Upload video with metadata
      await file.save(videoBuffer, {
        metadata: {
          contentType: this._getVideoContentType(fileName),
          metadata: {
            originalName: fileName,
            chatbotId: chatbotId,
            userId: userId,
            contentType: 'video',
            isPublic: isPublic.toString(),
            uploadedAt: new Date().toISOString()
          }
        }
      });

      // Handle URL generation based on privacy setting
      if (isPublic) {
        // For public videos, use direct public URL
        const bucketName = bucket.name;
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;
        
        console.log(`✅ Public video stored with direct public URL: ${filePath}`);
        return {
          success: true,
          storagePath: filePath,
          publicUrl: publicUrl
        };
      } else {
        console.log(`✅ Private video stored: ${filePath}`);
        return {
          success: true,
          storagePath: filePath
        };
      }

    } catch (error) {
      console.error('Firebase video storage error:', error);
      return {
        success: false,
        error: `Failed to store video in Firebase: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Generate a signed URL for video access
   */
  static async generateSignedUrl(
    storagePath: string,
    firebaseProjectId: string,
    expirationHours: number = 24
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const { Storage } = require('@google-cloud/storage');
      
      const credentials = {
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        project_id: process.env.FIREBASE_PROJECT_ID,
      };
      
      const projectSpecificStorage = new Storage({
        projectId: firebaseProjectId,
        credentials: credentials
      });
      
      // Use same bucket detection logic as storeVideoInFirebase
      const chatbotBucketName = `${firebaseProjectId}-chatbot-documents`;
      let bucket;
      
      try {
        bucket = projectSpecificStorage.bucket(chatbotBucketName);
        await bucket.getMetadata();
      } catch (bucketError) {
        const fallbackBuckets = [
          `${firebaseProjectId}.appspot.com`,
          firebaseProjectId,
          `${firebaseProjectId}-default-rtdb`,
          `${firebaseProjectId}-storage`,
          `${firebaseProjectId}-firebase-chatbot-documents`,
        ];
        
        let bucketFound = false;
        for (const bucketName of fallbackBuckets) {
          try {
            bucket = projectSpecificStorage.bucket(bucketName);
            await bucket.getMetadata();
            bucketFound = true;
            break;
          } catch (err) {
            continue;
          }
        }
        
        if (!bucketFound) {
          throw new Error(`No accessible storage buckets found in project ${firebaseProjectId}`);
        }
      }
      
      const file = bucket.file(storagePath);
      
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * 60 * 60 * expirationHours,
      });
      
      return {
        success: true,
        url: signedUrl
      };
      
    } catch (error) {
      console.error('Failed to generate signed URL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process video with transcription container
   */
  static async processVideoWithTranscription(
    request: VideoProcessingRequest
  ): Promise<VideoTranscriptionResult> {
    try {
      console.log(`🔄 Processing video with transcription: ${request.file.name}`);
      console.log(`📝 Embedding model: jina/${request.embeddingModel}`);
      console.log(`🎯 Pinecone index: ${request.pineconeIndex}`);
      console.log(`🔒 Privacy setting: ${request.isPublic ? 'Public' : 'Private'}`);

      // Get video URL first (we need to upload to Firebase first)
      const videoBuffer = Buffer.from(await request.file.arrayBuffer());
      
      // Store video in Firebase to get URL for transcription service
      const storageResult = await this.storeVideoInFirebase(
        videoBuffer,
        request.chatbotId,
        request.userId,
        request.file.name,
        request.firebaseProjectId,
        request.isPublic
      );

      if (!storageResult.success) {
        return {
          success: false,
          error: `Failed to store video: ${storageResult.error}`
        };
      }

      // Get video URL for transcription service
      // Always use signed URLs for all videos (public and private) to avoid 403 errors
      let videoUrl = '';
      if (storageResult.storagePath) {
        const signedUrlResult = await this.generateSignedUrl(
          storageResult.storagePath,
          request.firebaseProjectId,
          24 // 24 hours
        );
        videoUrl = signedUrlResult.success ? signedUrlResult.url! : '';
      }

      if (!videoUrl) {
        return {
          success: false,
          error: 'Failed to generate video URL for transcription'
        };
      }

      // Call video transcription service
      const requestData = {
        video_url: videoUrl,
        video_name: request.file.name,
        chatbot_id: request.chatbotId,
        user_id: request.userId,
        language: request.language,
        enable_processing: request.enableProcessing || false,
        // Pinecone parameters
        pinecone_index: request.pineconeIndex,
        pinecone_namespace: request.pineconeNamespace,
        embedding_model: request.embeddingModel
      };

      console.log(`📞 Calling video transcription service...`);
      
      // Select service URL based on GPU preference
      const serviceUrl = request.useGPU 
        ? (process.env.VIDEO_TRANSCRIBER_GPU_URL || VIDEO_TRANSCRIBER_URL)
        : (process.env.VIDEO_TRANSCRIBER_CPU_URL || VIDEO_TRANSCRIBER_URL);
      
      console.log(`🎯 Using ${request.useGPU ? 'GPU' : 'CPU'} service: ${serviceUrl}`);
      
      const response = await fetch(`${serviceUrl}/transcribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
        // Long timeout for video processing
        signal: AbortSignal.timeout(1800000) // 30 minutes
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Video transcription failed: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`📄 Video transcription result:`, result);

      // Add storage info to result
      result.video_url = storageResult.publicUrl || storageResult.storagePath;

      return result;

    } catch (error) {
      console.error('Video transcription processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown processing error'
      };
    }
  }

  /**
   * Complete video processing: upload, transcribe, and embed
   */
  static async processVideoDocument(
    request: VideoProcessingRequest
  ): Promise<VideoProcessingResult> {
    try {
      console.log(`🔄 Starting video processing for: ${request.file.name}`);

      // Process video with transcription service
      const transcriptionResult = await this.processVideoWithTranscription(request);
      
      if (!transcriptionResult.success) {
        return {
          success: false,
          error: `Video processing failed: ${transcriptionResult.error}`
        };
      }

      // Create video metadata in database
      const videoMetadataResult = await DatabaseService.createVideoMetadata({
        userId: request.userId,
        chatbotId: request.chatbotId,
        originalFileName: request.file.name,
        videoFileName: request.file.name,
        isPublic: request.isPublic || false,
        firebaseStoragePath: transcriptionResult.video_url || '',
        firebaseProjectId: request.firebaseProjectId,
        ...(transcriptionResult.video_url && { publicUrl: transcriptionResult.video_url }),
        fileSize: request.file.size,
        duration: transcriptionResult.duration,
        language: transcriptionResult.language,
        transcription: transcriptionResult.transcription,
        status: 'completed',
        vectorCount: transcriptionResult.vector_count || 0
      });

      if (!videoMetadataResult.success) {
        console.warn('⚠️ Failed to create video metadata:', videoMetadataResult.error);
      }

      // Update document count if vectors were created
      if (transcriptionResult.vector_count && transcriptionResult.vector_count > 0) {
        await DatabaseService.updateVectorstoreDocumentCount(request.chatbotId, 1);
      }

      console.log(`✅ Video processing completed: ${transcriptionResult.vector_count || 0} vectors created`);

      return {
        success: true,
        message: `Video transcribed and embedded successfully`,
        vectorCount: transcriptionResult.vector_count || 0,
        videoUrl: transcriptionResult.video_url,
        transcription: transcriptionResult.transcription,
        duration: transcriptionResult.duration,
        language: transcriptionResult.language
      };

    } catch (error) {
      console.error('Video processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown processing error'
      };
    }
  }

  /**
   * Health check for video transcription service
   */
  static async healthCheck(): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      const response = await fetch(`${VIDEO_TRANSCRIBER_URL}/health`);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        status: result.status
      };

    } catch (error) {
      console.error('Video transcriber health check failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Service unavailable'
      };
    }
  }

  /**
   * Health check for CPU video transcription service
   */
  static async healthCheckCPU(): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      const cpuUrl = process.env.VIDEO_TRANSCRIBER_CPU_URL || VIDEO_TRANSCRIBER_URL;
      const response = await fetch(`${cpuUrl}/health`);
      
      if (!response.ok) {
        throw new Error(`CPU health check failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        status: result.status
      };

    } catch (error) {
      console.error('Video transcriber CPU health check failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Service unavailable'
      };
    }
  }

  /**
   * Health check for GPU video transcription service
   */
  static async healthCheckGPU(): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      const gpuUrl = process.env.VIDEO_TRANSCRIBER_GPU_URL || VIDEO_TRANSCRIBER_URL;
      const response = await fetch(`${gpuUrl}/health`);
      
      if (!response.ok) {
        throw new Error(`GPU health check failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        status: result.status
      };

    } catch (error) {
      console.error('Video transcriber GPU health check failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Service unavailable'
      };
    }
  }

  /**
   * Get video content type based on file extension
   */
  private static _getVideoContentType(fileName: string): string {
    const ext = fileName.toLowerCase().split('.').pop();
    switch (ext) {
      case 'mp4':
        return 'video/mp4';
      case 'avi':
        return 'video/x-msvideo';
      case 'mov':
        return 'video/quicktime';
      case 'mkv':
        return 'video/x-matroska';
      case 'webm':
        return 'video/webm';
      case 'wmv':
        return 'video/x-ms-wmv';
      default:
        return 'video/mp4'; // Default fallback
    }
  }
}
