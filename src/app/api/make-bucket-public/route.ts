// DEBUG: API endpoint to make the chatbot-document-images bucket public
import { NextRequest, NextResponse } from 'next/server';
import { BucketConfigService } from '@/services/bucketConfigService';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Making chatbot-document-images bucket public...');
    
    const result = await BucketConfigService.makeImagesBucketPublic();
    
    if (result.success) {
      console.log('✅ Success:', result.message);
      return NextResponse.json({
        success: true,
        message: result.message
      });
    } else {
      console.error('❌ Failed:', result.message);
      return NextResponse.json({
        success: false,
        error: result.message
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('❌ API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Simple test endpoint
  const projectId = process.env.REUSABLE_FIREBASE_PROJECT_ID;
  const bucketName = `${projectId}-chatbot-document-images`;
  
  return NextResponse.json({
    message: 'Make bucket public endpoint',
    targetBucket: bucketName,
    projectId: projectId
  });
}