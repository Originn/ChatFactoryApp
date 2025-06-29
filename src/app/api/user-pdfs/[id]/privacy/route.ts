import { NextRequest, NextResponse } from 'next/server';
import { DatabaseService } from '@/services/databaseService';
import { PDFPrivacyToggleResponse } from '@/types/pdf';

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

    // Handle storage-level privacy change
    let newUrl: string | undefined = undefined;
    
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

      if (isPublic) {
        // Make file public
        await file.makePublic();
        newUrl = `https://storage.googleapis.com/${bucketName}/${pdf.firebaseStoragePath}`;
        console.log(`✅ Made PDF ${pdfId} public`);
      } else {
        // Make file private (remove public access)
        await file.acl.delete({ entity: 'allUsers' }).catch(() => {
          // Ignore error if allUsers permission doesn't exist
        });
        console.log(`✅ Made PDF ${pdfId} private`);
      }

    } catch (storageError) {
      console.error('Failed to update storage permissions:', storageError);
      return NextResponse.json({ 
        error: 'Failed to update PDF storage permissions' 
      }, { status: 500 });
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
