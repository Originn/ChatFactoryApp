import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin/index';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbotId');
    const domain = searchParams.get('domain');

    if (!chatbotId || !domain) {
      return NextResponse.json({ 
        error: 'Missing required parameters: chatbotId and domain' 
      }, { status: 400 });
    }

    // Get the chatbot data
    const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
    
    if (!chatbotDoc.exists) {
      return NextResponse.json({ 
        error: 'Chatbot not found' 
      }, { status: 404 });
    }

    const chatbotData = chatbotDoc.data();
    const projectName = chatbotData?.deployment?.vercelProjectId;

    if (!projectName) {
      return NextResponse.json({ 
        error: 'Chatbot not deployed yet' 
      }, { status: 400 });
    }

    const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
    if (!VERCEL_API_TOKEN) {
      return NextResponse.json({ 
        error: 'Vercel API token not configured' 
      }, { status: 500 });
    }

    // Get domain info from Vercel
    const domainResponse = await fetch(
      `https://api.vercel.com/v9/projects/${projectName}/domains/${domain}`,
      {
        headers: {
          'Authorization': `Bearer ${VERCEL_API_TOKEN}`
        }
      }
    );

    if (!domainResponse.ok) {
      const error = await domainResponse.json();
      return NextResponse.json({ 
        error: error.error?.message || 'Failed to get domain info',
        configured: false
      }, { status: 400 });
    }

    const domainData = await domainResponse.json();

    return NextResponse.json({
      success: true,
      domain: domainData.name,
      verified: domainData.verified || false,
      configured: true,
      verification: domainData.verification || [],
      status: domainData.verified ? 'active' : 'pending_verification',
      createdAt: domainData.createdAt,
      updatedAt: domainData.updatedAt
    });

  } catch (error: any) {
    console.error('Domain info error:', error);
    return NextResponse.json({ 
      error: 'Failed to get domain info',
      details: error.message 
    }, { status: 500 });
  }
}
