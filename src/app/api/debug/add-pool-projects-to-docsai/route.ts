import { NextResponse } from 'next/server';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

export async function POST() {
  try {
    console.log('🏊 Adding pool projects to docsai-chatbot-app Firestore...');

    // Initialize connection to docsai-chatbot-app project
    const serviceAccountKey = {
      "type": "service_account",
      "project_id": "docsai-chatbot-app",
      "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
      "private_key": process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      "client_email": process.env.FIREBASE_CLIENT_EMAIL,
      "client_id": process.env.FIREBASE_CLIENT_ID,
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token",
      "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
      "client_x509_cert_url": `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
    };

    // Check if app already exists, if not initialize it
    const appName = 'docsai-chatbot-app';
    const existingApps = getApps();
    let docsaiApp = existingApps.find(app => app.name === appName);

    if (!docsaiApp) {
      docsaiApp = initializeApp({
        credential: cert(serviceAccountKey as any),
        projectId: 'docsai-chatbot-app'
      }, appName);
    }

    const docsaiDb = getFirestore(docsaiApp);

    const poolProjects = [
      'chatfactory-pool-001',
      'chatfactory-pool-002',
      'chatfactory-pool-003',
    ];

    const batch = docsaiDb.batch();
    let addedCount = 0;

    for (const projectId of poolProjects) {
      // Check if project already exists
      const existingDoc = await docsaiDb.collection('firebaseProjectMappings').doc(projectId).get();

      if (!existingDoc.exists) {
        console.log(`➕ Adding pool project to docsai-chatbot-app: ${projectId}`);

        const projectRef = docsaiDb.collection('firebaseProjectMappings').doc(projectId);
        batch.set(projectRef, {
          projectId,
          projectType: 'pool',
          status: 'available',
          chatbotId: null,
          userId: null,
          lastUsedAt: null,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });

        addedCount++;
      } else {
        console.log(`ℹ️ Pool project already exists in docsai-chatbot-app: ${projectId}`);
      }
    }

    if (addedCount > 0) {
      await batch.commit();
      console.log(`✅ Added ${addedCount} pool projects to docsai-chatbot-app mapping`);
    }

    // Get updated status
    const snapshot = await docsaiDb.collection('firebaseProjectMappings').get();
    const projects = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
      lastUsedAt: doc.data().lastUsedAt?.toDate?.()?.toISOString() || null,
    }));

    const stats = {
      total: projects.length,
      available: projects.filter((p: any) => p.status === 'available').length,
      inUse: projects.filter((p: any) => p.status === 'in-use').length
    };

    return NextResponse.json({
      message: `Added ${addedCount} pool projects to docsai-chatbot-app. Total pool status:`,
      added: addedCount,
      projects,
      stats,
      database: 'docsai-chatbot-app'
    });

  } catch (error: any) {
    console.error('❌ Error adding pool projects to docsai-chatbot-app:', error);
    return NextResponse.json(
      { error: 'Failed to add pool projects to docsai-chatbot-app', details: error.message },
      { status: 500 }
    );
  }
}