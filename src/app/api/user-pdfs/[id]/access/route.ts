import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/services/databaseService';
import { PDFAccessResponse } from '@/types/pdf';

// GET /api/user-pdfs/[id]/access - Get access URL for a PDF
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pdfId = params.id;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ 
        error: 'Missing required parameter: userId' 
      }, { status: 400 });
    }

    console.log(`🔗 Generating access URL for PDF: ${pdfId} for user: ${userId}`);

    // Get PDF metadata
    const pdfResult = await DatabaseService.getPDFMetadata(pdfId);
    
    if (!pdfResult.success || !pdfResult.pdf) {
      return NextResponse.json({ 
        error: 'PDF not found' 
      }, { status: 404 });
    }

    const pdf = pdfResult.pdf;

    // Verify user owns this PDF
    if (pdf.userId !== userId) {
      return NextResponse.json({ 
        error: 'Unauthorized: PDF does not belong to user' 
      }, { status: 403 });
    }

    // If PDF is public, return the public URL
    if (pdf.isPublic && pdf.publicUrl) {
      const response: PDFAccessResponse = {
        success: true,
        accessUrl: pdf.publicUrl,
        expiresAt: 'never' // Public URLs don't expire
      };
      
      console.log(`✅ Returning public URL for PDF ${pdfId}`);
      return NextResponse.json(response);
    }

    // For private PDFs, generate a signed URL
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
      
      // Generate signed URL valid for 24 hours
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + 24);
      
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: expirationDate.getTime()
      });

      const response: PDFAccessResponse = {
        success: true,
        accessUrl: signedUrl,
        expiresAt: expirationDate.toISOString()
      };

      console.log(`✅ Generated signed URL for private PDF ${pdfId}`);
      return NextResponse.json(response);

    } catch (storageError) {
      console.error('Failed to generate signed URL:', storageError);
      return NextResponse.json({ 
        error: 'Failed to generate access URL for private PDF' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('PDF access API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error while generating access URL' 
    }, { status: 500 });
  }
}
