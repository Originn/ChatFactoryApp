import { NextRequest, NextResponse } from 'next/server';
import { PineconeService } from '@/services/pineconeService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatbotId, userId, documentName, documentType, textContent, source } = body;

    if (!chatbotId || !userId || !documentName || !textContent) {
      return NextResponse.json({ 
        error: 'Missing required fields: chatbotId, userId, documentName, textContent' 
      }, { status: 400 });
    }

    console.log(`📄 Processing document upload: ${documentName} for chatbot: ${chatbotId}`);

    const result = await PineconeService.uploadDocument(
      chatbotId,
      userId,
      documentName,
      documentType || 'text',
      textContent,
      source
    );

    if (result.success) {
      console.log(`✅ Successfully uploaded ${result.vectorCount} vectors for document: ${documentName}`);
      return NextResponse.json({
        success: true,
        message: `Document processed and uploaded successfully`,
        vectorCount: result.vectorCount,
        indexName: PineconeService.generateIndexName(chatbotId)
      });
    } else {
      console.error(`❌ Failed to upload document: ${documentName}`, result.error);
      return NextResponse.json({ 
        error: result.error || 'Failed to upload document' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Document upload API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during document upload' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatbotId, documentName } = body;

    if (!chatbotId || !documentName) {
      return NextResponse.json({ 
        error: 'Missing required fields: chatbotId, documentName' 
      }, { status: 400 });
    }

    const result = await PineconeService.deleteDocument(chatbotId, documentName);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Document deleted successfully`
      });
    } else {
      return NextResponse.json({ 
        error: result.error || 'Failed to delete document' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Document delete API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during document deletion' 
    }, { status: 500 });
  }
}
