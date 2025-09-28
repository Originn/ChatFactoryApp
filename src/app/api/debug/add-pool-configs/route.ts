import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST() {
  try {
    console.log('⚙️ Adding Firebase configs to pool projects...');

    // Sample Firebase configs for each pool project
    const poolConfigs = {
      'chatfactory-pool-001': {
        apiKey: "AIzaSyA_pool001_sample_api_key",
        authDomain: "chatfactory-pool-001.firebaseapp.com",
        projectId: "chatfactory-pool-001",
        storageBucket: "chatfactory-pool-001.appspot.com",
        messagingSenderId: "123456789001",
        appId: "1:123456789001:web:pool001sample"
      },
      'chatfactory-pool-002': {
        apiKey: "AIzaSyA_pool002_sample_api_key",
        authDomain: "chatfactory-pool-002.firebaseapp.com",
        projectId: "chatfactory-pool-002",
        storageBucket: "chatfactory-pool-002.appspot.com",
        messagingSenderId: "123456789002",
        appId: "1:123456789002:web:pool002sample"
      },
      'chatfactory-pool-003': {
        apiKey: "AIzaSyA_pool003_sample_api_key",
        authDomain: "chatfactory-pool-003.firebaseapp.com",
        projectId: "chatfactory-pool-003",
        storageBucket: "chatfactory-pool-003.appspot.com",
        messagingSenderId: "123456789003",
        appId: "1:123456789003:web:pool003sample"
      }
    };

    const batch = adminDb.batch();
    let updatedCount = 0;

    for (const [projectId, config] of Object.entries(poolConfigs)) {
      const projectRef = adminDb.collection('firebaseProjects').doc(projectId);
      const existingDoc = await projectRef.get();

      if (existingDoc.exists) {
        const data = existingDoc.data();

        // Add config and other required fields if missing
        if (!data?.config) {
          console.log(`⚙️ Adding config to ${projectId}`);

          batch.update(projectRef, {
            config,
            displayName: `${projectId} Pool Project`,
            status: 'active', // Firebase project status
            buckets: {
              documents: `${projectId}-chatbot_documents`,
              privateImages: `${projectId}-chatbot_private_images`,
              documentImages: `${projectId}-chatbot_documents_images`
            },
            completedAt: Timestamp.now()
          });

          updatedCount++;
        } else {
          console.log(`ℹ️ ${projectId} already has configuration`);
        }
      } else {
        console.log(`⚠️ ${projectId} not found in firebaseProjects collection`);
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`✅ Added configs to ${updatedCount} pool projects`);
    }

    return NextResponse.json({
      message: `Added Firebase configs to ${updatedCount} pool projects`,
      updated: updatedCount,
      configs: poolConfigs
    });

  } catch (error: any) {
    console.error('❌ Error adding pool configs:', error);
    return NextResponse.json(
      { error: 'Failed to add pool configs', details: error.message },
      { status: 500 }
    );
  }
}