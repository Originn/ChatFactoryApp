import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/services/databaseService';
import { PineconeService } from '@/services/pineconeService';
import { UserPDFListResponse } from '@/types/pdf';

// GET /api/user-pdfs - List user's PDFs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const chatbotId = searchParams.get('chatbotId'); // Optional filter

    if (!userId) {
      return NextResponse.json({ 
        error: 'Missing required parameter: userId' 
      }, { status: 400 });
    }

    console.log(`📋 Fetching PDFs for user: ${userId}${chatbotId ? ` in chatbot: ${chatbotId}` : ''}`);

    const result = await DatabaseService.getUserPDFs(userId, chatbotId || undefined);

    if (result.success) {
      const response: UserPDFListResponse = {
        success: true,
        pdfs: result.pdfs
      };

      console.log(`✅ Retrieved ${result.pdfs.length} PDFs for user ${userId}`);
      return NextResponse.json(response);
    } else {
      console.error(`❌ Failed to get user PDFs:`, result.error);
      return NextResponse.json({ 
        error: result.error || 'Failed to retrieve PDFs' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('User PDFs API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error while retrieving PDFs' 
    }, { status: 500 });
  }
}

// DELETE /api/user-pdfs - Delete a PDF and its metadata completely
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdfId, userId } = body;

    if (!pdfId || !userId) {
      return NextResponse.json({ 
        error: 'Missing required fields: pdfId, userId' 
      }, { status: 400 });
    }

    console.log(`🗑️ Starting complete deletion for PDF ${pdfId} by user ${userId}`);

    // First verify the PDF belongs to the user
    const pdfResult = await DatabaseService.getPDFMetadata(pdfId);
    
    if (!pdfResult.success || !pdfResult.pdf) {
      return NextResponse.json({ 
        error: 'PDF not found' 
      }, { status: 404 });
    }

    const pdf = pdfResult.pdf;

    if (pdf.userId !== userId) {
      return NextResponse.json({ 
        error: 'Unauthorized: PDF does not belong to user' 
      }, { status: 403 });
    }

    console.log(`📁 Deleting PDF: ${pdf.pdfFileName} from ${pdf.firebaseStoragePath}`);

    let deletionErrors: string[] = [];

    // Step 1: Delete PDF file from Firebase Storage
    try {
      const { Storage } = require('@google-cloud/storage');
      
      const credentials = {
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        project_id: process.env.FIREBASE_PROJECT_ID,
      };
      
      const storage = new Storage({
        projectId: pdf.firebaseProjectId,
        credentials: credentials
      });
      
      const bucketName = `${pdf.firebaseProjectId}-chatbot-documents`;
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(pdf.firebaseStoragePath);

      // Check if file exists before trying to delete
      const [exists] = await file.exists();
      if (exists) {
        await file.delete();
        console.log(`✅ Deleted PDF file from storage: ${pdf.firebaseStoragePath}`);
      } else {
        console.log(`⚠️ PDF file not found in storage (may have been deleted already): ${pdf.firebaseStoragePath}`);
      }
    } catch (storageError) {
      console.error('❌ Failed to delete PDF from storage:', storageError);
      deletionErrors.push(`Storage deletion failed: ${storageError instanceof Error ? storageError.message : 'Unknown error'}`);
    }

    // Step 2: Delete vectors from Pinecone (if they exist)
    try {
      const vectorDeletionResult = await PineconeService.deleteDocument(
        pdf.chatbotId, 
        pdf.pdfFileName
      );

      if (vectorDeletionResult.success) {
        console.log(`✅ Deleted vectors for: ${pdf.pdfFileName}`);
      } else {
        console.log(`⚠️ Vector deletion warning: ${vectorDeletionResult.error}`);
        // Don't treat vector deletion failure as critical error since vectors might not exist
      }
    } catch (vectorError) {
      console.error('❌ Failed to delete vectors:', vectorError);
      // Don't treat vector deletion failure as critical error
      console.log(`⚠️ Vector deletion failed but continuing: ${vectorError instanceof Error ? vectorError.message : 'Unknown error'}`);
    }

    // Step 3: Update chatbot document count
    try {
      await DatabaseService.updateVectorstoreDocumentCount(pdf.chatbotId, -1);
      console.log(`✅ Updated document count for chatbot ${pdf.chatbotId}`);
    } catch (countError) {
      console.error('❌ Failed to update document count:', countError);
      deletionErrors.push(`Document count update failed: ${countError instanceof Error ? countError.message : 'Unknown error'}`);
    }

    // Step 4: Delete PDF metadata from Firestore
    const deleteResult = await DatabaseService.deletePDFMetadata(pdfId);

    if (deleteResult.success) {
      console.log(`✅ Deleted PDF metadata ${pdfId} for user ${userId}`);
      
      if (deletionErrors.length > 0) {
        return NextResponse.json({
          success: true,
          message: 'PDF deleted successfully with some warnings',
          warnings: deletionErrors
        });
      } else {
        return NextResponse.json({
          success: true,
          message: 'PDF and all related data deleted successfully'
        });
      }
    } else {
      console.error(`❌ Failed to delete PDF metadata:`, deleteResult.error);
      return NextResponse.json({ 
        error: deleteResult.error || 'Failed to delete PDF metadata' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('PDF deletion API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error while deleting PDF',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
