import { NextRequest, NextResponse } from 'next/server';

const CHM_CONVERTER_URL = process.env.CHM_CONVERTER_URL || 'https://chm-converter-931513743743.us-central1.run.app';

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

    console.log(`📄 Processing CHM conversion: ${file.name} for chatbot: ${chatbotId}`);

    // Create FormData for CHM converter service
    const chmFormData = new FormData();
    chmFormData.append('file', file);

    // Call CHM converter service
    const response = await fetch(`${CHM_CONVERTER_URL}/convert`, {
      method: 'POST',
      body: chmFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ CHM conversion failed:`, errorText);
      return NextResponse.json({ 
        error: `CHM conversion failed: ${response.statusText}` 
      }, { status: 500 });
    }

    const result = await response.json();
    
    if (result.status === 'completed') {
      console.log(`✅ CHM conversion completed: ${result.job_id}`);
      
      return NextResponse.json({
        success: true,
        message: 'CHM conversion completed successfully',
        job_id: result.job_id,
        download_url: `${CHM_CONVERTER_URL}${result.download_url}`,
        file_size: result.file_size,
        pdf_file: result.pdf_file
      });
    } else if (result.status === 'queued') {
      console.log(`⏳ CHM conversion queued: ${result.job_id}`);
      
      return NextResponse.json({
        success: true,
        status: 'queued',
        message: 'CHM conversion queued for processing',
        job_id: result.job_id,
        queue_position: result.queue_position,
        estimated_time_seconds: result.estimated_time_seconds,
        status_url: `${CHM_CONVERTER_URL}/status/${result.job_id}`
      });
    } else {
      return NextResponse.json({ 
        error: 'CHM conversion returned unknown status' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('CHM conversion API error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during CHM conversion' 
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

    // Check job status
    const response = await fetch(`${CHM_CONVERTER_URL}/status/${jobId}`);
    
    if (!response.ok) {
      return NextResponse.json({ 
        error: 'Failed to check conversion status' 
      }, { status: 500 });
    }

    const status = await response.json();
    
    return NextResponse.json({
      success: true,
      status: status.status,
      message: status.message,
      ...(status.download_url && { 
        download_url: `${CHM_CONVERTER_URL}${status.download_url}`,
        file_size: status.file_size 
      })
    });

  } catch (error) {
    console.error('CHM status check error:', error);
    return NextResponse.json({ 
      error: 'Internal server error during status check' 
    }, { status: 500 });
  }
}
