import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST() {
  try {
    console.log('⚙️ Adding Firebase configs to pool projects...');

    // Generate Firebase configs for all pool projects (001-026)
    const poolConfigs: Record<string, any> = {};

    for (let i = 1; i <= 26; i++) {
      const poolNumber = i.toString().padStart(3, '0');
      const projectId = `chatfactory-pool-${poolNumber}`;

      poolConfigs[projectId] = {
        apiKey: `AIzaSyA_pool${poolNumber}_sample_api_key`,
        authDomain: `${projectId}.firebaseapp.com`,
        projectId: projectId,
        storageBucket: `${projectId}.appspot.com`,
        messagingSenderId: `12345678900${i}`,
        appId: `1:12345678900${i}:web:pool${poolNumber}sample`
      };
    }

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
            status: 'available', // Project mapping status (not Firebase project status)
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