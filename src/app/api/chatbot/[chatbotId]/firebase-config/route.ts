import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { chatbotId: string } }
) {
  try {
    const { chatbotId } = params;

    if (!chatbotId) {
      return NextResponse.json(
        { error: 'Chatbot ID is required' },
        { status: 400 }
      );
    }

    console.log('🔧 Retrieving Firebase config for chatbot:', chatbotId);

    // Get chatbot data from Firestore
    const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
    
    if (!chatbotDoc.exists) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      );
    }

    const chatbotData = chatbotDoc.data();
    
    // Get Firebase config from the chatbot deployment info
    let firebaseConfig = null;
    
    // Try to get from deployment info first
    if (chatbotData?.deployment?.firebaseConfig) {
      firebaseConfig = chatbotData.deployment.firebaseConfig;
      console.log('✅ Found Firebase config in deployment info');
    }
    // Fallback to direct firebaseConfig field
    else if (chatbotData?.firebaseConfig) {
      firebaseConfig = chatbotData.firebaseConfig;
      console.log('✅ Found Firebase config in chatbot data');
    }
    // Check if there's a dedicated Firebase project
    else if (chatbotData?.firebaseProjectId) {
      console.log('🔍 Looking up dedicated Firebase project:', chatbotData.firebaseProjectId);
      
      // Try to get from Firebase projects collection
      const firebaseProjectDoc = await adminDb
        .collection('firebaseProjects')
        .doc(chatbotData.firebaseProjectId)
        .get();
      
      if (firebaseProjectDoc.exists) {
        const projectData = firebaseProjectDoc.data();
        firebaseConfig = projectData?.config;
        console.log('✅ Found Firebase config in projects collection');
      }
    }

    if (!firebaseConfig) {
      console.warn('⚠️ No Firebase config found for chatbot');
      return NextResponse.json(
        { error: 'Firebase configuration not found for this chatbot' },
        { status: 404 }
      );
    }

    // Validate the config has required fields
    const requiredFields = ['apiKey', 'authDomain', 'projectId'];
    const missingFields = requiredFields.filter(field => !firebaseConfig[field]);
    
    if (missingFields.length > 0) {
      console.warn('⚠️ Firebase config missing required fields:', missingFields);
      return NextResponse.json(
        { error: `Firebase configuration incomplete. Missing: ${missingFields.join(', ')}` },
        { status: 500 }
      );
    }

    // Validate API key format
    if (!firebaseConfig.apiKey.startsWith('AIza')) {
      console.warn('⚠️ Firebase API key appears to be invalid');
      return NextResponse.json(
        { error: 'Invalid Firebase API key configuration' },
        { status: 500 }
      );
    }

    console.log('✅ Returning valid Firebase config for chatbot');
    console.log('🔧 Config summary:', {
      projectId: firebaseConfig.projectId,
      authDomain: firebaseConfig.authDomain,
      hasValidApiKey: firebaseConfig.apiKey.startsWith('AIza'),
      apiKeyLength: firebaseConfig.apiKey.length
    });

    return NextResponse.json({
      success: true,
      config: firebaseConfig
    });

  } catch (error: any) {
    console.error('❌ Error retrieving Firebase config:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
