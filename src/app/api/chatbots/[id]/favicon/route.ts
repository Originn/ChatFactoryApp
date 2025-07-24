// DEBUG: API route for processing favicon after chatbot creation
import { NextRequest, NextResponse } from 'next/server';
import { processFaviconUpload } from '@/lib/favicon-processor';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const chatbotId = params.id;
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || !chatbotId) {
      return NextResponse.json(
        { error: 'File and chatbotId are required' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/x-icon', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload PNG, ICO, or SVG.' },
        { status: 400 }
      );
    }

    // Validate file size (1MB max)
    if (file.size > 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size must be less than 1MB' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get file extension
    const originalExtension = file.name.split('.').pop()?.toLowerCase();

    // Process and upload favicon variants
    const urls = await processFaviconUpload(buffer, chatbotId, `.${originalExtension}`);

    return NextResponse.json({ urls });

  } catch (error) {
    console.error('Favicon processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process favicon' },
      { status: 500 }
    );
  }
}
