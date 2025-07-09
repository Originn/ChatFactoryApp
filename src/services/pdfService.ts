import { adminStorage } from '@/lib/firebase/admin';
import { PineconeService } from '@/services/pineconeService';
import { DatabaseService } from '@/services/databaseService';
import { PDFStorageResult } from '@/types/pdf';
import { getPDFExpirationHours } from '@/config/pdfAccess';

const PDF_CONVERTER_URL = process.env.PDF_CONVERTER_URL || 'https://pdf-converter-931513743743.us-central1.run.app';

interface PDFProcessingRequest {
  file: File;
  chatbotId: string;
  userId: string;
  firebaseProjectId: string;
  isPublic?: boolean;
  // Embedding configuration
  embeddingProvider: 'openai' | 'cohere' | 'voyage' | 'azure' | 'huggingface' | 'bedrock' | 'jina';
  embeddingModel: string;
  multimodal?: boolean;
  dimensions?: number;
  // Pinecone configuration
  pineconeIndex: string;
  pineconeNamespace?: string;
  // Image storage configuration
  imageStorageBucket?: string;
}

interface PDFConversionResult {
  success: boolean;
  message?: string;
  processing_output?: string;
  pinecone_index?: string;
  pinecone_namespace?: string;
  file_processed?: string;
  embedding_provider?: string;
  embedding_model?: string;
  dimensions?: number;
  error?: string;
}

interface PDFProcessingResult {
  success: boolean;
  message?: string;
  vectorCount?: number;
  pdfUrl?: string;
  error?: string;
}

export class PDFService {
  
  /**
   * Process PDF file using the PDF converter service with embedding configuration
   */
  static async processPDFWithEmbeddings(
    request: PDFProcessingRequest
  ): Promise<PDFConversionResult> {
    try {
      const formData = new FormData();
      formData.append('file', request.file);
      formData.append('pinecone_index', request.pineconeIndex);
      
      if (request.pineconeNamespace) {
        formData.append('pinecone_namespace', request.pineconeNamespace);
      }
      
      // Add embedding configuration
      formData.append('embedding_provider', request.embeddingProvider);
      formData.append('embedding_model', request.embeddingModel);
      
      if (request.multimodal) {
        formData.append('multimodal', 'true');
      }
      
      if (request.dimensions) {
        formData.append('dimensions', request.dimensions.toString());
      }

      // Add image storage bucket
      if (request.imageStorageBucket) {
        formData.append('image_storage_bucket', request.imageStorageBucket);
      }

      // 🔒 SECURITY: Pass privacy flag to cloud converter
      if (request.isPublic !== undefined) {
        formData.append('is_public', request.isPublic.toString());
      }

      console.log(`🔄 Processing PDF with converter: ${request.file.name}`);
      console.log(`📝 Embedding config: ${request.embeddingProvider}/${request.embeddingModel}`);
      console.log(`🔒 Privacy setting: ${request.isPublic ? 'Public' : 'Private'}`);

      const response = await fetch(`${PDF_CONVERTER_URL}/process-pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PDF processing failed: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`📄 PDF processing result:`, result);

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'PDF processing failed'
        };
      }

      return {
        success: true,
        message: result.message,
        processing_output: result.processing_output,
        pinecone_index: result.pinecone_index,
        pinecone_namespace: result.pinecone_namespace,
        file_processed: result.file_processed,
        embedding_provider: result.embedding_provider,
        embedding_model: result.embedding_model,
        dimensions: result.dimensions
      };

    } catch (error) {
      console.error('PDF processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown processing error'
      };
    }
  }

  /**
   * Store PDF in Firebase Storage with public/private access control
   */
  static async storePDFInFirebase(
    pdfBuffer: Buffer, 
    chatbotId: string, 
    userId: string,
    fileName: string,
    firebaseProjectId: string,
    isPublic: boolean = false
  ): Promise<PDFStorageResult> {
    try {
      // Use direct credential loading (same pattern as CHM service)
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
      
      console.log(`📋 Storing PDF in project: ${firebaseProjectId}`);
      
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
        filePath = `public_pdfs/${chatbotId}/${sanitizedFileName}.pdf`;
      } else {
        filePath = `private_pdfs/${userId}/${chatbotId}/${sanitizedFileName}.pdf`;
      }
      
      const file = bucket.file(filePath);
      
      // Upload PDF with metadata
      await file.save(pdfBuffer, {
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            originalName: fileName,
            chatbotId: chatbotId,
            userId: userId,
            convertedFrom: 'pdf',
            isPublic: isPublic.toString(),
            uploadedAt: new Date().toISOString()
          }
        }
      });

      // Handle URL generation based on privacy setting
      if (isPublic) {
        try {
          // Generate signed URL for public access (works with uniform bucket-level access)
          const expirationHours = getPDFExpirationHours('public');
          const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 1000 * 60 * 60 * expirationHours,
          });
          
          console.log(`✅ Public PDF stored with signed URL: ${filePath}`);
          return {
            success: true,
            storagePath: filePath,
            publicUrl: signedUrl
          };
        } catch (urlError) {
          console.error('Failed to generate signed URL:', urlError);
          return {
            success: false,
            storagePath: filePath,
            error: 'Failed to generate public access URL'
          };
        }
      } else {
        console.log(`✅ Private PDF stored: ${filePath}`);
        return {
          success: true,
          storagePath: filePath
        };
      }

    } catch (error) {
      console.error('Firebase storage error:', error);
      return {
        success: false,
        storagePath: '',
        error: `Failed to store PDF in Firebase: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Generate a new signed URL for an existing PDF file
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
      
      const chatbotBucketName = `${firebaseProjectId}-chatbot-documents`;
      const bucket = projectSpecificStorage.bucket(chatbotBucketName);
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
   * Complete PDF processing: upload to vectorstore via Cloud Run service and store metadata
   */
  static async processPDFDocument(
    request: PDFProcessingRequest
  ): Promise<PDFProcessingResult> {
    try {
      console.log(`🔄 Starting PDF processing for: ${request.file.name}`);

      // Step 1: Process PDF with the Cloud Run service (includes vectorization)
      const processingResult = await this.processPDFWithEmbeddings(request);
      
      if (!processingResult.success) {
        return {
          success: false,
          error: `PDF processing failed: ${processingResult.error}`
        };
      }

      // Step 2: Get PDF file content for storage (optional - if you want local backup)
      const pdfBuffer = Buffer.from(await request.file.arrayBuffer());

      // Step 3: Store PDF in Firebase (optional backup)
      const storageResult = await this.storePDFInFirebase(
        pdfBuffer,
        request.chatbotId,
        request.userId,
        request.file.name.replace('.pdf', ''),
        request.firebaseProjectId,
        request.isPublic
      );

      if (!storageResult.success) {
        console.warn('⚠️ Failed to store PDF backup in Firebase:', storageResult.error);
        // Don't fail the entire process if backup storage fails
      }

      // Step 4: Create PDF metadata in database
      const pdfMetadataResult = await DatabaseService.createPDFMetadata({
        userId: request.userId,
        chatbotId: request.chatbotId,
        originalFileName: request.file.name,
        pdfFileName: request.file.name,
        isPublic: request.isPublic || false,
        firebaseStoragePath: storageResult.storagePath || '',
        firebaseProjectId: request.firebaseProjectId,
        ...(storageResult.publicUrl && { publicUrl: storageResult.publicUrl }),
        fileSize: pdfBuffer.length,
        status: 'completed' // Already processed by Cloud Run service
      });

      if (!pdfMetadataResult.success) {
        console.warn('⚠️ Failed to create PDF metadata:', pdfMetadataResult.error);
      }

      // Step 5: Update document count (assuming successful vectorization)
      await DatabaseService.updateVectorstoreDocumentCount(request.chatbotId, 1);

      // Extract vector count from processing output if available
      let vectorCount = 0;
      if (processingResult.processing_output) {
        const vectorMatch = processingResult.processing_output.match(/(\d+)\s*vectors?\s*created/i);
        if (vectorMatch) {
          vectorCount = parseInt(vectorMatch[1], 10);
        }
      }

      // Update PDF status with vector count if we have metadata
      if (pdfMetadataResult.pdfId && vectorCount > 0) {
        await DatabaseService.updatePDFStatus(pdfMetadataResult.pdfId, 'completed', undefined, vectorCount);
      }

      console.log(`✅ PDF processing completed: ${vectorCount} vectors created`);

      return {
        success: true,
        message: `PDF document processed successfully`,
        vectorCount: vectorCount,
        pdfUrl: storageResult.publicUrl || storageResult.storagePath
      };

    } catch (error) {
      console.error('PDF processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown processing error'
      };
    }
  }

  /**
   * List available embedding models from the PDF converter service
   */
  static async listAvailableModels(): Promise<{ success: boolean; models?: string; error?: string }> {
    try {
      const response = await fetch(`${PDF_CONVERTER_URL}/list-models`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        models: result.models_output
      };

    } catch (error) {
      console.error('Error fetching available models:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Health check for the PDF converter service
   */
  static async healthCheck(): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      const response = await fetch(`${PDF_CONVERTER_URL}/health`);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        success: true,
        status: result.status
      };

    } catch (error) {
      console.error('PDF converter health check failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Service unavailable'
      };
    }
  }
}