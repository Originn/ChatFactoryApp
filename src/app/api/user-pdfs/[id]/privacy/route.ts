import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/services/databaseService';
import { PDFService } from '@/services/pdfService';
import { PDFPrivacyToggleResponse } from '@/types/pdf';
import { getPDFExpirationHours } from '@/config/pdfAccess';

// PUT /api/user-pdfs/[id]/privacy - Toggle PDF privacy (public/private)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const pdfId = params.id;
    const body = await request.json();
    const { isPublic, userId } = body;

    if (typeof isPublic !== 'boolean' || !userId) {
      return NextResponse.json({ 
        error: 'Missing required fields: isPublic (boolean), userId' 
      }, { status: 400 });
    }

    console.log(`🔐 Updating PDF ${pdfId} privacy to ${isPublic ? 'public' : 'private'} for user ${userId}`);

    // Get current PDF metadata
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

    // If no change needed
    if (pdf.isPublic === isPublic) {
      const response: PDFPrivacyToggleResponse = {
        success: true,
        message: `PDF is already ${isPublic ? 'public' : 'private'}`,
        newUrl: pdf.publicUrl
      };
      return NextResponse.json(response);
    }

    // Generate new signed URL for public access (compatible with uniform bucket-level access)
    let newUrl: string | undefined = undefined;
    
    if (isPublic) {
      try {
        const expirationHours = getPDFExpirationHours('public');
        const signedUrlResult = await PDFService.generateSignedUrl(
          pdf.firebaseStoragePath,
          pdf.firebaseProjectId,
          expirationHours
        );

        if (signedUrlResult.success) {
          newUrl = signedUrlResult.url;
          console.log(`✅ Generated long-term signed URL for public PDF ${pdfId}`);
        } else {
          console.error('Failed to generate signed URL:', signedUrlResult.error);
          return NextResponse.json({ 
            error: 'Failed to generate public access URL' 
          }, { status: 500 });
        }
      } catch (storageError) {
        console.error('Failed to generate signed URL:', storageError);
        return NextResponse.json({ 
          error: 'Failed to generate public access URL' 
        }, { status: 500 });
      }
    }

    // Update database
    const updateResult = await DatabaseService.updatePDFPrivacy(pdfId, isPublic, newUrl);

    if (updateResult.success) {
      const response: PDFPrivacyToggleResponse = {
        success: true,
        message: `PDF privacy updated to ${isPublic ? 'public' : 'private'}`,
        newUrl: newUrl
      };

      console.log(`✅ Updated PDF ${pdfId} privacy in database`);
      return NextResponse.json(response);
    } else {
      console.error(`❌ Failed to update PDF privacy in database:`, updateResult.error);
      return NextResponse.json({ 
        error: updateResult.error || 'Failed to update PDF privacy' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('PDF privacy toggle API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error while updating PDF privacy' 
    }, { status: 500 });
  }
}