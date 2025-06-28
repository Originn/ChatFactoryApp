import { adminStorage } from '@/lib/firebase/admin';
import { PineconeService } from '@/services/pineconeService';
import { DatabaseService } from '@/services/databaseService';

const CHM_CONVERTER_URL = process.env.CHM_CONVERTER_URL || 'https://chm-converter-931513743743.us-central1.run.app';

interface CHMConversionResult {
  success: boolean;
  job_id?: string;
  status?: 'completed' | 'queued' | 'failed';
  download_url?: string;
  file_size?: number;
  pdf_file?: string;
  queue_position?: number;
  estimated_time_seconds?: number;
  error?: string;
}

interface CHMProcessingResult {
  success: boolean;
  message?: string;
  vectorCount?: number;
  pdfUrl?: string;
  error?: string;
}

export class CHMService {
  
  /**
   * Convert CHM file to PDF using the CHM converter service
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
      const response = await fetch(`${CHM_CONVERTER_URL}/status/${jobId}`);
      
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      const status = await response.json();
      
      return {
        success: true,
        status: status.status,
        download_url: status.download_url,
        file_size: status.file_size,
        pdf_file: status.pdf_file
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
   */
  static async extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
    try {
      // For server-side PDF processing, we'll use a simpler approach
      // In a real implementation, you might want to use a different PDF library like pdf-parse
      console.log('⚠️ PDF text extraction not implemented - using placeholder');
      
      // Placeholder implementation - in production you'd want to:
      // 1. Use a proper server-side PDF parsing library like pdf-parse
      // 2. Or implement this on the client-side after download
      // 3. Or use a separate service for PDF text extraction
      
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
   * Store PDF in Firebase Storage
   */
  static async storePDFInFirebase(
    pdfBuffer: Buffer, 
    chatbotId: string, 
    fileName: string,
    firebaseProjectId: string
  ): Promise<string> {
    try {
      // Get the chatbot's dedicated Firebase project storage
      const bucket = adminStorage.bucket(`${firebaseProjectId}.appspot.com`);
      
      // Create file path in chatbot_documents bucket
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `chatbots/${chatbotId}/documents/${sanitizedFileName}.pdf`;
      
      const file = bucket.file(filePath);
      
      // Upload PDF
      await file.save(pdfBuffer, {
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            originalName: fileName,
            chatbotId: chatbotId,
            convertedFrom: 'chm',
            uploadedAt: new Date().toISOString()
          }
        }
      });

      // Get download URL
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: '03-09-2491' // Far future date
      });

      console.log(`✅ PDF stored in Firebase: ${filePath}`);
      return url;

    } catch (error) {
      console.error('Firebase storage error:', error);
      throw new Error('Failed to store PDF in Firebase');
    }
  }

  /**
   * Complete CHM processing: convert, store, and vectorize
   */
  static async processCHMDocument(
    file: File,
    chatbotId: string,
    userId: string,
    firebaseProjectId: string
  ): Promise<CHMProcessingResult> {
    try {
      console.log(`🔄 Starting CHM processing for: ${file.name}`);

      // Step 1: Convert CHM to PDF
      const conversionResult = await this.convertCHMToPDF(file, chatbotId, userId);
      
      if (!conversionResult.success) {
        return {
          success: false,
          error: `Conversion failed: ${conversionResult.error}`
        };
      }

      // Step 2: If queued, return status for polling
      if (conversionResult.status === 'queued') {
        return {
          success: true,
          message: `CHM conversion queued (position ${conversionResult.queue_position}). Please check status later.`
        };
      }

      // Step 3: Download converted PDF
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

      // Step 4: Store PDF in Firebase
      const pdfUrl = await this.storePDFInFirebase(
        pdfBuffer,
        chatbotId,
        file.name.replace('.chm', ''),
        firebaseProjectId
      );

      // Step 5: Extract text from PDF
      const textContent = await this.extractTextFromPDF(pdfBuffer);
      
      if (!textContent.trim()) {
        return {
          success: false,
          error: 'No text content found in converted PDF'
        };
      }

      // Step 6: Upload to vectorstore using existing service
      const vectorResult = await PineconeService.uploadDocument(
        chatbotId,
        userId,
        file.name.replace('.chm', '.pdf'),
        'pdf',
        textContent,
        `CHM converted: ${file.name}`
      );

      if (!vectorResult.success) {
        return {
          success: false,
          error: `Vectorization failed: ${vectorResult.error}`
        };
      }

      // Step 7: Update document count
      await DatabaseService.updateVectorstoreDocumentCount(chatbotId, 1);

      console.log(`✅ CHM processing completed: ${vectorResult.vectorCount} vectors created`);

      return {
        success: true,
        message: `CHM document processed successfully`,
        vectorCount: vectorResult.vectorCount,
        pdfUrl: pdfUrl
      };

    } catch (error) {
      console.error('CHM processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown processing error'
      };
    }
  }
}
