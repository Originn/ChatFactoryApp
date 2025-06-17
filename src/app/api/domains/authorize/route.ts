import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin/index';
import { FirebaseAuthorizedDomainsService } from '@/services/firebaseAuthorizedDomainsService';

export async function POST(request: NextRequest) {
  try {
    const { chatbotId, customDomain } = await request.json();

    if (!chatbotId || !customDomain) {
      return NextResponse.json({ 
        error: 'Missing required fields: chatbotId and customDomain' 
      }, { status: 400 });
    }

    // Validate domain format
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(customDomain)) {
      return NextResponse.json({ 
        error: 'Invalid domain format' 
      }, { status: 400 });
    }

    // Get chatbot data to find Firebase project
    const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
    
    if (!chatbotDoc.exists) {
      return NextResponse.json({ 
        error: 'Chatbot not found' 
      }, { status: 404 });
    }

    const chatbotData = chatbotDoc.data();
    const firebaseProjectId = chatbotData?.deployment?.firebaseProjectId || 
                             chatbotData?.firebaseProject?.projectId;

    if (!firebaseProjectId) {
      return NextResponse.json({ 
        error: 'Firebase project not found for this chatbot' 
      }, { status: 400 });
    }

    console.log(`🔧 Adding custom domain ${customDomain} to Firebase authorized domains for project ${firebaseProjectId}`);

    // Add custom domain to Firebase authorized domains
    const customDomainUrl = `https://${customDomain}`;
    const success = await FirebaseAuthorizedDomainsService.ensureVercelDomainAuthorized(
      firebaseProjectId,
      customDomainUrl
    );

    if (success) {
      // Update chatbot document to record that custom domain is authorized
      await adminDb.collection('chatbots').doc(chatbotId).update({
        'deployment.customDomainAuthorized': true,
        'deployment.customDomainAuthorizedAt': new Date(),
        updatedAt: new Date()
      });

      return NextResponse.json({
        success: true,
        message: `Custom domain ${customDomain} successfully added to Firebase authorized domains`,
        domain: customDomain,
        firebaseProjectId,
        consoleUrl: `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to authorize custom domain in Firebase',
        domain: customDomain,
        firebaseProjectId,
        manualInstructions: {
          message: 'Please add the domain manually in Firebase Console',
          domain: customDomain,
          consoleUrl: `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`,
          steps: [
            '1. Go to Firebase Console > Authentication > Settings',
            '2. Scroll to "Authorized domains"',
            `3. Click "Add domain" and add: ${customDomain}`,
            '4. Save the changes'
          ]
        }
      }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Firebase authorized domains API error:', error);
    return NextResponse.json({ 
      error: 'Failed to authorize custom domain',
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbotId');

    if (!chatbotId) {
      return NextResponse.json({ 
        error: 'Missing chatbotId parameter' 
      }, { status: 400 });
    }

    // Get chatbot data
    const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
    
    if (!chatbotDoc.exists) {
      return NextResponse.json({ 
        error: 'Chatbot not found' 
      }, { status: 404 });
    }

    const chatbotData = chatbotDoc.data();
    const firebaseProjectId = chatbotData?.deployment?.firebaseProjectId || 
                             chatbotData?.firebaseProject?.projectId;

    if (!firebaseProjectId) {
      return NextResponse.json({ 
        error: 'Firebase project not found for this chatbot' 
      }, { status: 400 });
    }

    // Get current authorized domains from Firebase
    const authorizedDomains = await FirebaseAuthorizedDomainsService.getAuthorizedDomains(firebaseProjectId);

    return NextResponse.json({
      success: true,
      firebaseProjectId,
      authorizedDomains,
      customDomain: chatbotData?.domain || null,
      customDomainAuthorized: chatbotData?.deployment?.customDomainAuthorized || false,
      consoleUrl: `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/settings`
    });

  } catch (error: any) {
    console.error('Get authorized domains API error:', error);
    return NextResponse.json({ 
      error: 'Failed to get authorized domains',
      details: error.message 
    }, { status: 500 });
  }
}
