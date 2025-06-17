// DEBUG: Simple API route to add custom domain to existing Vercel project
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin/index';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chatbotId, domain, projectName } = body;

    console.log('🌐 Adding domain to existing Vercel project:', { chatbotId, domain, projectName });

    if (!chatbotId || !domain) {
      return NextResponse.json({ 
        error: 'Missing required fields: chatbotId, domain' 
      }, { status: 400 });
    }

    // Get Vercel API token
    const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
    if (!VERCEL_API_TOKEN) {
      return NextResponse.json({ 
        error: 'Vercel API token not configured' 
      }, { status: 500 });
    }

    // Use project name from the deployment or default to chatbot name format
    const vercelProjectName = projectName || `testbot`; // You can make this dynamic

    console.log(`📡 Adding domain "${domain}" to Vercel project "${vercelProjectName}"`);

    // Add domain to existing Vercel project
    const addDomainResponse = await fetch(
      `https://api.vercel.com/v10/projects/${vercelProjectName}/domains`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: domain
        })
      }
    );

    if (!addDomainResponse.ok) {
      const error = await addDomainResponse.json();
      console.error('❌ Failed to add domain to Vercel:', error);
      
      if (error.error?.code === 'domain_already_exists') {
        console.log('✅ Domain already exists on project');
      } else {
        return NextResponse.json({ 
          error: `Failed to add domain: ${error.error?.message || 'Unknown error'}` 
        }, { status: 500 });
      }
    }

    const domainData = await addDomainResponse.json();
    console.log('✅ Domain added to Vercel successfully:', domainData);

    // Update Firestore with the domain using admin SDK
    await adminDb.collection('chatbots').doc(chatbotId).update({
      domain: domain,
      updatedAt: Timestamp.now()
    });

    console.log('✅ Domain saved to database');

    return NextResponse.json({
      success: true,
      message: `Domain "${domain}" added successfully to project "${vercelProjectName}"`,
      domain: {
        name: domainData.name,
        verified: domainData.verified,
        verification: domainData.verification
      }
    });

  } catch (error: any) {
    console.error('❌ Error adding domain:', error);
    return NextResponse.json({ 
      error: `Error adding domain: ${error.message}` 
    }, { status: 500 });
  }
}
