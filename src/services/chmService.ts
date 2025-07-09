import { adminStorage } from '@/lib/firebase/admin';
import { PineconeService } from '@/services/pineconeService';
import { DatabaseService } from '@/services/databaseService';
import { PDFStorageResult } from '@/types/pdf';

// Updated to use the enhanced CHM converter with embeddings
const CHM_CONVERTER_URL = process.env.CHM_CONVERTER_URL || 'https://chm-converter-931513743743.us-central1.run.app';

interface CHMProcessingRequest {
  file: File;
  chatbotId: string;
  userId: string;
  firebaseProjectId: string;
  isPublic?: boolean;
  // Embedding configuration (same as PDF)
  embeddingProvider: 'openai' | 'cohere' | 'voyage' | 'azure' | 'huggingface' | 'bedrock' | 'jina';
  embeddingModel: string;
  dimensions?: number;
  // Pinecone configuration
  pineconeIndex: string;
  pineconeNamespace?: string;
  // Image storage configuration
  imageStorageBucket?: string;
}

interface CHMConversionResult {
  success: boolean;
  job_id?: string;
  status?: 'completed' | 'queued' | 'processing' | 'processing_embeddings' | 'failed';
  download_url?: string;
  file_size?: number;
  pdf_file?: string;
  queue_position?: number;
  estimated_time_seconds?: number;
  // Enhanced result fields
  message?: string;
  processing_output?: string;
  pinecone_index?: string;
  pinecone_namespace?: string;
  file_processed?: string;
  embedding_provider?: string;
  embedding_model?: string;
  embedding_enabled?: boolean;
  embedding_config?: string;
  pinecone_vectors_uploaded?: number;
  vectorCount?: number;
  chunks_generated?: number;
  mode?: string;
  error?: string;
}

interface CHMProcessingResult {
  success: boolean;
  message?: string;
  vectorCount?: number;
  pdfUrl?: string;
  error?: string;
  mode?: string;
  // Job tracking fields for polling
  jobId?: string;
  status?: 'queued' | 'processing' | 'processing_embeddings' | 'completed' | 'failed';
  queuePosition?: number;
  estimatedTimeSeconds?: number;
}

export class CHMService {
  
  /**
   * Process CHM file using the enhanced CHM converter with embeddings
   */
  static async processCHMWithEmbeddings(
    request: CHMProcessingRequest
  ): Promise<CHMConversionResult> {
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

      console.log(`🔄 Processing CHM with enhanced converter: ${request.file.name}`);
      console.log(`📝 Embedding config: ${request.embeddingProvider}/${request.embeddingModel}`);
      console.log(`📊 Pinecone: ${request.pineconeIndex}${request.pineconeNamespace ? `/${request.pineconeNamespace}` : ''}`);
      console.log(`🔒 Privacy setting: ${request.isPublic ? 'Public' : 'Private'}`);
      const response = await fetch(`${CHM_CONVERTER_URL}/convert`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(`CHM processing failed: ${response.statusText} - ${errorData.error || 'Unknown error'}`);
      }

      const result = await response.json();
      console.log(`📄 Enhanced CHM processing result:`, result);

      // Handle error responses that come with 200 status but contain errors
      if (result.error) {
        return {
          success: false,
          error: result.error
        };
      }

      // Our enhanced API returns job info directly
      return {
        success: true,
        job_id: result.job_id,
        status: result.status,
        queue_position: result.queue_position,
        estimated_time_seconds: result.estimated_time_seconds,
        message: result.message,
        embedding_enabled: result.embedding_enabled,
        embedding_config: result.embedding_config
      };

    } catch (error) {
      console.error('Enhanced CHM processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown processing error'
      };
    }
  }

  /**
   * Convert CHM file to PDF using the old converter (fallback)
   * @deprecated Use processCHMWithEmbeddings instead
   */
  static async convertCHMToPDF(file: File, chatbotId: string, userId: string): Promise<CHMConversionResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${CHM_CONVERTER_URL}/convert`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`CHM conversion failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`📄 CHM conversion result:`, result);

      return {
        success: true,
        job_id: result.job_id,
        status: result.status,
        download_url: result.download_url,
        file_size: result.file_size,
        pdf_file: result.pdf_file,
        queue_position: result.queue_position,
        estimated_time_seconds: result.estimated_time_seconds
      };

    } catch (error) {
      console.error('CHM conversion error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown conversion error'
      };
    }
  }

  /**
   * Check status of CHM conversion job
   */
  static async checkConversionStatus(jobId: string): Promise<CHMConversionResult> {
    try {
      console.log(`🔍 Checking status for job: ${jobId}`);
      const response = await fetch(`${CHM_CONVERTER_URL}/status/${jobId}`);
      
      if (!response.ok) {
        console.error(`❌ Status check failed: ${response.status} ${response.statusText}`);
        console.error(`🔗 URL: ${CHM_CONVERTER_URL}/status/${jobId}`);
        
        // Try to get error details from response
        try {
          const errorData = await response.json();
          console.error(`📋 Error details:`, errorData);
        } catch (parseError) {
          console.error(`📋 Could not parse error response`);
        }
        
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      const status = await response.json();
      console.log(`📊 Job status:`, status);
      
      return {
        success: true,
        status: status.status,
        download_url: status.download_url,
        file_size: status.file_size,
        pdf_file: status.pdf_file,
        message: status.message,
        // Enhanced status fields
        embedding_enabled: status.embedding_enabled,
        pinecone_vectors_uploaded: status.pinecone_vectors_uploaded,
        chunks_generated: status.chunks_generated,
        embedding_model: status.embedding_model
      };

    } catch (error) {
      console.error('Status check error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown status check error'
      };
    }
  }

  /**
   * Download converted PDF from CHM service
   * @deprecated Only needed for old converter workflow
   */
  static async downloadPDF(downloadUrl: string): Promise<Buffer | null> {
    try {
      const response = await fetch(`${CHM_CONVERTER_URL}${downloadUrl}`);
      
      if (!response.ok) {
        throw new Error(`PDF download failed: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);

    } catch (error) {
      console.error('PDF download error:', error);
      return null;
    }
  }

  /**
   * Extract text from PDF buffer using PDF.js
   * @deprecated Only needed for old converter workflow
   */
  static async extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
    try {
      // For server-side PDF processing, we'll use a simpler approach
      // In a real implementation, you might want to use a different PDF library like pdf-parse
      console.log('⚠️ PDF text extraction not implemented - using placeholder');
      
      return `[PDF Content Extracted from CHM file - ${pdfBuffer.length} bytes]
      
This is a placeholder for PDF text extraction. The CHM file has been successfully converted to PDF and stored.
To implement full text search, you would need to:
1. Install a server-side PDF parsing library (like pdf-parse)
2. Extract the actual text content from the PDF
3. Process it for vectorization

For now, the PDF is stored and can be accessed directly.`;

    } catch (error) {
      console.error('PDF text extraction error:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }

  /**
   * Store PDF in Firebase Storage with public/private access control
   * @deprecated Only needed for old converter workflow
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
      // 🔧 FIX: Use direct credential loading instead of module imports (more reliable in Next.js)
      const { Storage } = require('@google-cloud/storage');
      
      // Direct credential loading (avoids Next.js module loading issues)
      const credentials = {
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        project_id: process.env.FIREBASE_PROJECT_ID,
      };
      
      const projectSpecificStorage = new Storage({
        projectId: firebaseProjectId,
        credentials: credentials
      });
      
      console.log(`📋 Storing CHM PDF in project: ${firebaseProjectId} (using project-specific Storage client)`);
      
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
          throw new Error(`No accessible storage buckets found in project ${firebaseProjectId}. Expected bucket: ${chatbotBucketName}`);
        }
      }
      
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      let filePath: string;
      
      if (isPublic) {
        filePath = `public_pdfs/${chatbotId}/${sanitizedFileName}.pdf`;
      } else {
        filePath = `private_pdfs/${userId}/${chatbotId}/${sanitizedFileName}.pdf`;
      }
      
      const file = bucket.file(filePath);
      
      await file.save(pdfBuffer, {
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            originalName: fileName,
            chatbotId: chatbotId,
            userId: userId,
            convertedFrom: 'chm',
            isPublic: isPublic.toString(),
            uploadedAt: new Date().toISOString()
          }
        }
      });

      if (isPublic) {
        try {
          // Generate signed URL for public access (works with uniform bucket-level access)
          const [signedUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year from now
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
   * Complete CHM processing with enhanced embeddings: convert, store, and vectorize
   */
  static async processCHMDocument(
    file: File,
    chatbotId: string,
    userId: string,
    firebaseProjectId: string,
    isPublic: boolean = false,
    // NEW: Embedding configuration parameters (same as PDF service)
    embeddingProvider: 'openai' | 'cohere' | 'voyage' | 'azure' | 'huggingface' | 'bedrock' | 'jina' = 'openai',
    embeddingModel: string = 'text-embedding-3-small',
    dimensions?: number,
    pineconeIndex?: string,
    pineconeNamespace?: string,
    imageStorageBucket?: string
  ): Promise<CHMProcessingResult> {
    try {
      console.log(`🔄 Starting enhanced CHM processing for: ${file.name}`);

      // If embeddings are configured, use the enhanced converter
      if (pineconeIndex) {
        console.log(`🚀 Using enhanced CHM converter with embeddings`);
        
        const enhancedResult = await this.processCHMWithEmbeddings({
          file,
          chatbotId,
          userId,
          firebaseProjectId,
          isPublic,
          embeddingProvider,
          embeddingModel,
          dimensions,
          pineconeIndex,
          pineconeNamespace,
          imageStorageBucket
        });

        if (!enhancedResult.success) {
          return {
            success: false,
            error: `Enhanced CHM processing failed: ${enhancedResult.error}`
          };
        }

        // If processing is queued, return job info for polling
        if (enhancedResult.status === 'queued') {
          return {
            success: false,  // ✅ Not success until completed
            message: `CHM conversion queued (position ${enhancedResult.queue_position}). Processing will start shortly.`,
            jobId: enhancedResult.job_id,
            status: 'queued',
            queuePosition: enhancedResult.queue_position,
            estimatedTimeSeconds: enhancedResult.estimated_time_seconds
          };
        }

        // Job is still processing
        if (enhancedResult.status === 'processing' || enhancedResult.status === 'processing_embeddings') {
          return {
            success: false,  // ✅ Not success until completed
            message: `CHM processing in progress (${enhancedResult.status}). Please wait.`,
            jobId: enhancedResult.job_id,
            status: enhancedResult.status
          };
        }

        // For completed jobs, the enhanced converter handles everything
        if (enhancedResult.status === 'completed') {
          return {
            success: true,
            message: `CHM document processed successfully with embeddings`,
            vectorCount: enhancedResult.vectorCount || enhancedResult.pinecone_vectors_uploaded || enhancedResult.chunks_generated || 0,
            pdfUrl: `${CHM_CONVERTER_URL}/download/${enhancedResult.job_id}`, // PDF download URL
            mode: enhancedResult.mode || 'enhanced_complete' // ✅ Preserve mode from CHM container
          };
        }

        // Job failed
        if (enhancedResult.status === 'failed') {
          return {
            success: false,
            error: `CHM processing failed: ${enhancedResult.error || 'Unknown error'}`
          };
        }

        // Unexpected status
        return {
          success: false,
          error: `Unexpected processing status: ${enhancedResult.status}`
        };
      } else {
        // Fallback to old converter workflow (CHM → PDF only, manual vectorization)
        console.log(`⚠️ Using legacy CHM converter (no embeddings configured)`);
        
        const conversionResult = await this.convertCHMToPDF(file, chatbotId, userId);
        
        if (!conversionResult.success) {
          return {
            success: false,
            error: `Conversion failed: ${conversionResult.error}`
          };
        }

        if (conversionResult.status === 'queued') {
          return {
            success: true,
            message: `CHM conversion queued (position ${conversionResult.queue_position}). Please check status later.`
          };
        }

        if (!conversionResult.download_url) {
          return {
            success: false,
            error: 'No download URL provided by converter'
          };
        }

        const pdfBuffer = await this.downloadPDF(conversionResult.download_url);
        if (!pdfBuffer) {
          return {
            success: false,
            error: 'Failed to download converted PDF'
          };
        }

        const storageResult = await this.storePDFInFirebase(
          pdfBuffer,
          chatbotId,
          userId,
          file.name.replace('.chm', ''),
          firebaseProjectId,
          isPublic
        );

        if (!storageResult.success) {
          return {
            success: false,
            error: storageResult.error
          };
        }

        const pdfMetadataResult = await DatabaseService.createPDFMetadata({
          userId,
          chatbotId,
          originalFileName: file.name,
          pdfFileName: file.name.replace('.chm', '.pdf'),
          isPublic,
          firebaseStoragePath: storageResult.storagePath,
          firebaseProjectId,
          ...(storageResult.publicUrl && { publicUrl: storageResult.publicUrl }),
          fileSize: pdfBuffer.length,
          status: 'converting'
        });

        if (!pdfMetadataResult.success) {
          console.warn('⚠️ Failed to create PDF metadata:', pdfMetadataResult.error);
        }

        const textContent = await this.extractTextFromPDF(pdfBuffer);
        
        if (!textContent.trim()) {
          if (pdfMetadataResult.pdfId) {
            await DatabaseService.updatePDFStatus(pdfMetadataResult.pdfId, 'failed', 'No text content found in converted PDF');
          }
          return {
            success: false,
            error: 'No text content found in converted PDF'
          };
        }

        const vectorResult = await PineconeService.uploadDocument(
          chatbotId,
          userId,
          file.name.replace('.chm', '.pdf'),
          'pdf',
          textContent,
          `CHM converted: ${file.name}`
        );

        if (!vectorResult.success) {
          if (pdfMetadataResult.pdfId) {
            await DatabaseService.updatePDFStatus(pdfMetadataResult.pdfId, 'failed', `Vectorization failed: ${vectorResult.error}`);
          }
          return {
            success: false,
            error: `Vectorization failed: ${vectorResult.error}`
          };
        }

        await DatabaseService.updateVectorstoreDocumentCount(chatbotId, 1);
        
        if (pdfMetadataResult.pdfId) {
          await DatabaseService.updatePDFStatus(pdfMetadataResult.pdfId, 'completed', undefined, vectorResult.vectorCount);
        }

        console.log(`✅ Legacy CHM processing completed: ${vectorResult.vectorCount} vectors created`);

        return {
          success: true,
          message: `CHM document processed successfully`,
          vectorCount: vectorResult.vectorCount,
          pdfUrl: storageResult.publicUrl || storageResult.storagePath
        };
      }

    } catch (error) {
      console.error('CHM processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown processing error'
      };
    }
  }

  /**
   * Poll for job completion (for frontend polling)
   */
  static async pollJobCompletion(jobId: string): Promise<CHMProcessingResult> {
    try {
      const statusResult = await this.checkConversionStatus(jobId);
      
      if (!statusResult.success) {
        return {
          success: false,
          error: statusResult.error
        };
      }

      if (statusResult.status === 'completed') {
        return {
          success: true,
          message: 'CHM document processed successfully with embeddings',
          vectorCount: statusResult.pinecone_vectors_uploaded || statusResult.chunks_generated || 0,
          pdfUrl: `${CHM_CONVERTER_URL}/download/${jobId}`,
          status: 'completed'
        };
      }

      if (statusResult.status === 'failed') {
        return {
          success: false,
          error: `CHM processing failed: ${statusResult.message || 'Unknown error'}`,
          status: 'failed'
        };
      }

      // Still processing
      return {
        success: false,
        message: `CHM processing in progress (${statusResult.status})`,
        jobId: jobId,
        status: statusResult.status as any
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown polling error'
      };
    }
  }

  /**
   * Health check for CHM converter service
   */
  static async healthCheck(): Promise<{ success: boolean; status?: string; error?: string }> {
    try {
      const response = await fetch(`${CHM_CONVERTER_URL}/health`);
      
      if (!response.ok) {
        return {
          success: false,
          error: `Health check failed: ${response.statusText}`
        };
      }
      
      const result = await response.json();
      
      return {
        success: true,
        status: result.status || 'healthy'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }
}
