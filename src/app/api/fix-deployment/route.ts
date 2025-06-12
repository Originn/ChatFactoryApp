import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const { chatbotId, firebaseProjectId } = await request.json();

    if (!chatbotId) {
      return NextResponse.json({ error: 'Missing chatbot ID' }, { status: 400 });
    }

    console.log(`🔧 Creating deployment record for chatbot: ${chatbotId}`);

    // Get the chatbot data
    const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
    if (!chatbotDoc.exists) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    const chatbotData = chatbotDoc.data()!;

    // Check if deployment record already exists
    const existingDeployment = await adminDb
      .collection('deployments')
      .where('chatbotId', '==', chatbotId)
      .limit(1)
      .get();

    if (!existingDeployment.empty) {
      return NextResponse.json({ 
        error: 'Deployment record already exists',
        deploymentId: existingDeployment.docs[0].id 
      }, { status: 400 });
    }

    // Create a deployment record with the provided or generated Firebase project ID
    const actualFirebaseProjectId = firebaseProjectId || `testbot-${chatbotId.toLowerCase().substring(0, 8)}`;
    
    console.log(`🔧 Creating deployment record for chatbot ${chatbotId} with dedicated project ${actualFirebaseProjectId}`);
    
    const deploymentRecord = {
      chatbotId: chatbotId,
      userId: chatbotData.userId,
      status: 'deployed', // Set as deployed so user management works
      subdomain: chatbotData.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'chatbot',
      deploymentUrl: `https://${actualFirebaseProjectId}.web.app`,
      
      // Dedicated Firebase project information (NOT the main docsai project)
      firebaseProjectId: actualFirebaseProjectId,
      firebaseConfig: {
        projectId: actualFirebaseProjectId,
        authDomain: `${actualFirebaseProjectId}.firebaseapp.com`,
        storageBucket: `${actualFirebaseProjectId}.appspot.com`,
        apiKey: 'placeholder-api-key', // Will be filled when project is created
        messagingSenderId: '123456789', // Will be filled when project is created
        appId: 'placeholder-app-id', // Will be filled when project is created
      },
      
      branding: {
        show: true,
        text: 'Powered by ChatFactory',
        link: 'https://chatfactory.ai'
      },
      
      planLimitations: {
        monthlyQueryLimit: 1000, // Default for free plan
        analyticsRetention: 30,
        customDomain: false,
        branding: true
      },
      
      usage: {
        totalQueries: 0,
        monthlyQueries: 0,
        lastResetAt: Timestamp.now()
      },
      
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      deployedAt: Timestamp.now(),
      
      environmentVariables: {
        CHATBOT_ID: chatbotId,
        CHATBOT_CONFIG: JSON.stringify(chatbotData),
        NEXT_PUBLIC_FIREBASE_PROJECT_ID: actualFirebaseProjectId,
        FIREBASE_PROJECT_ID: actualFirebaseProjectId,
      }
    };

    // Create the deployment record
    const deploymentRef = await adminDb.collection('deployments').add(deploymentRecord);

    // Update the chatbot with deployment info
    await adminDb.collection('chatbots').doc(chatbotId).update({
      status: 'active',
      deployment: {
        deploymentId: deploymentRef.id,
        deploymentUrl: deploymentRecord.deploymentUrl,
        status: 'deployed',
        deployedAt: Timestamp.now(),
      },
      updatedAt: Timestamp.now()
    });

    console.log(`✅ Created deployment record: ${deploymentRef.id}`);

    return NextResponse.json({
      success: true,
      message: 'Deployment record created successfully',
      deploymentId: deploymentRef.id,
      firebaseProjectId: actualFirebaseProjectId,
      deploymentUrl: deploymentRecord.deploymentUrl,
      note: 'User management should now work properly'
    });

  } catch (error: any) {
    console.error('Fix deployment error:', error);
    return NextResponse.json({ 
      error: `Failed to create deployment record: ${error.message}` 
    }, { status: 500 });
  }
}

// GET endpoint to check deployment status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbotId');

    if (!chatbotId) {
      return NextResponse.json({ error: 'Missing chatbot ID' }, { status: 400 });
    }

    // Check current deployment status
    const deploymentsSnapshot = await adminDb
      .collection('deployments')
      .where('chatbotId', '==', chatbotId)
      .get();

    const deployments = deploymentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({
      chatbotId,
      deployments,
      hasDeployedStatus: deployments.some(d => (d as any).status === 'deployed'),
      canCreateDeployment: deployments.length === 0
    });

  } catch (error: any) {
    console.error('Check deployment error:', error);
    return NextResponse.json({ 
      error: `Failed to check deployment: ${error.message}` 
    }, { status: 500 });
  }
}
