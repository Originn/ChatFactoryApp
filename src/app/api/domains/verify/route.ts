import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin/index';

export async function POST(request: NextRequest) {
  try {
    const { chatbotId, domain } = await request.json();

    if (!chatbotId || !domain) {
      return NextResponse.json({ 
        error: 'Missing required fields: chatbotId and domain' 
      }, { status: 400 });
    }

    // Get the chatbot data to find the Vercel project
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

    // Verify the domain with Vercel
    const verifyResponse = await fetch(
      `https://api.vercel.com/v9/projects/${projectName}/domains/${domain}/verify`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      return NextResponse.json({ 
        success: false,
        error: error.error?.message || 'Domain verification failed'
      }, { status: 400 });
    }

    const verificationResult = await verifyResponse.json();
    
    // Update the chatbot deployment record
    if (verificationResult.verified) {
      await adminDb.collection('chatbots').doc(chatbotId).update({
        'deployment.domainVerified': true,
        'deployment.domainStatus': 'active',
        updatedAt: new Date()
      });
    }

    return NextResponse.json({
      success: true,
      verified: verificationResult.verified || false,
      domain: domain,
      message: verificationResult.verified ? 
        'Domain verified successfully!' : 
        'Domain verification pending. Please check your DNS settings.'
    });

  } catch (error: any) {
    console.error('Domain verification error:', error);
    return NextResponse.json({ 
      error: 'Failed to verify domain',
      details: error.message 
    }, { status: 500 });
  }
}
