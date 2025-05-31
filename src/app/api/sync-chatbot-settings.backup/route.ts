import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { chatbotId } = await request.json();

    if (!chatbotId) {
      return NextResponse.json({ error: 'Missing chatbot ID' }, { status: 400 });
    }

    const VERCEL_API_TOKEN = process.env.VERCEL_API_TOKEN;
    if (!VERCEL_API_TOKEN) {
      return NextResponse.json({ 
        error: 'Vercel API token not configured' 
      }, { status: 500 });
    }

    // Get chatbot data from Firestore
    const chatbotSnap = await adminDb.collection("chatbots").doc(chatbotId).get();
    
    if (!chatbotSnap.exists()) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    const chatbotData = chatbotSnap.data();
    
    if (!chatbotData?.vercelProjectId) {
      return NextResponse.json({ 
        error: 'Chatbot not deployed yet' 
      }, { status: 400 });
    }

    const projectName = chatbotData.vercelProjectId;

    // Update environment variables on Vercel project
    const envVarsToUpdate = {
      NEXT_PUBLIC_CHATBOT_ACCESS_MODE: chatbotData.authConfig?.accessMode || 'open',
      NEXT_PUBLIC_CHATBOT_WHITELISTED_EMAILS: chatbotData.authConfig?.whitelistedEmails?.join(',') || '',
    };

    let updateCount = 0;
    for (const [key, value] of Object.entries(envVarsToUpdate)) {
      try {
        const success = await updateEnvironmentVariable(VERCEL_API_TOKEN, projectName, key, value);
        if (success) {
          updateCount++;
        }
      } catch (error) {
        console.error(`Failed to update ${key}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updateCount} environment variables`,
      projectName,
      updatedSettings: {
        accessMode: envVarsToUpdate.NEXT_PUBLIC_CHATBOT_ACCESS_MODE,
        whitelistedEmails: envVarsToUpdate.NEXT_PUBLIC_CHATBOT_WHITELISTED_EMAILS ? 
          envVarsToUpdate.NEXT_PUBLIC_CHATBOT_WHITELISTED_EMAILS.split(',').length : 0
      }
    });

  } catch (error: any) {
    console.error('Sync settings error:', error);
    return NextResponse.json({ 
      error: `Failed to sync settings: ${error.message}` 
    }, { status: 500 });
  }
}
