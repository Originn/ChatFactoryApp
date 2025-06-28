import { NextRequest, NextResponse } from 'next/server';
import { CHMService } from '@/services/chmService';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const chatbotId = formData.get('chatbotId') as string;
    const userId = formData.get('userId') as string;

    if (!file || !chatbotId || !userId) {
      return NextResponse.json({ 
        error: 'Missing required fields: file, chatbotId, userId' 
      }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.chm')) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only .chm files are allowed.' 
      }, { status: 400 });
    }

    console.log(`📄 Processing CHM file: ${file.name} for chatbot: ${chatbotId}`);

    // Get Firebase project ID for this chatbot from database
    const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
    if (!chatbotDoc.exists) {
      return NextResponse.json({ 
        error: 'Chatbot not found' 
      }, { status: 404 });
    }

    const chatbotData = chatbotDoc.data();
    const firebaseProjectId = chatbotData?.firebaseProjectId || chatbotData?.deployment?.firebaseProjectId;
    
    if (!firebaseProjectId) {
      return NextResponse.json({ 
        error: 'Firebase project not configured for this chatbot' 
      }, { status: 404 });
    }

    console.log(`🔥 Using Firebase project: ${firebaseProjectId}`);

    // Process the CHM file completely (convert, store, vectorize)
    const result = await CHMService.processCHMDocument(
      file,
      chatbotId,
      userId,
      firebaseProjectId
    );

    if (result.success) {
      console.log(`✅ CHM processing completed: ${result.vectorCount} vectors created`);
      
      return NextResponse.json({
        success: true,
        message: result.message,
        vectorCount: result.vectorCount,
        pdfUrl: result.pdfUrl,
        fileName: file.name.replace('.chm', '.pdf')
      });
    } else {
      console.error(`❌ CHM processing failed:`, result.error);
      return NextResponse.json({ 
        error: result.error 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('CHM conversion API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during CHM processing' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ 
        error: 'Missing jobId parameter' 
      }, { status: 400 });
    }

    // Check job status with CHM converter service
    const status = await CHMService.checkConversionStatus(jobId);
    
    return NextResponse.json({
      success: status.success,
      status: status.status,
      message: status.status === 'completed' ? 'Conversion completed' : 'Still processing',
      ...(status.download_url && { 
        download_available: true
      })
    });

  } catch (error) {
    console.error('CHM status check error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during status check' 
    }, { status: 500 });
  }
}
