import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/services/databaseService';
import { PDFService } from '@/services/pdfService';
import { PDFAccessResponse } from '@/types/pdf';
import { getPDFExpirationHours } from '@/config/pdfAccess';

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

    // Handle CHM external URLs
    if (pdf.firebaseStoragePath.startsWith('chm-external:')) {
      const externalUrl = pdf.firebaseStoragePath.replace('chm-external:', '');
      const response: PDFAccessResponse = {
        success: true,
        accessUrl: externalUrl,
        expiresAt: 'never' // CHM external URLs don't expire
      };
      
      console.log(`✅ Returning CHM external URL for PDF ${pdfId}`);
      return NextResponse.json(response);
    }

    // For both public and private PDFs, generate signed URLs
    // This fixes the uniform bucket-level access issue
    try {
      const expirationHours = getPDFExpirationHours(pdf.isPublic ? 'public' : 'private');
      
      const signedUrlResult = await PDFService.generateSignedUrl(
        pdf.firebaseStoragePath,
        pdf.firebaseProjectId,
        expirationHours
      );

      if (!signedUrlResult.success) {
        console.error('Failed to generate signed URL:', signedUrlResult.error);
        return NextResponse.json({ 
          error: 'Failed to generate access URL' 
        }, { status: 500 });
      }

      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + expirationHours);

      const response: PDFAccessResponse = {
        success: true,
        accessUrl: signedUrlResult.url!,
        expiresAt: pdf.isPublic ? 'extended' : expirationDate.toISOString()
      };

      console.log(`✅ Generated signed URL for ${pdf.isPublic ? 'public' : 'private'} PDF ${pdfId}`);
      return NextResponse.json(response);

    } catch (storageError) {
      console.error('Failed to generate signed URL:', storageError);
      return NextResponse.json({ 
        error: 'Failed to generate access URL' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('PDF access API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error while generating access URL' 
    }, { status: 500 });
  }
}