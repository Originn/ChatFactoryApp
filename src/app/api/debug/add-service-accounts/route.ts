import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST() {
  try {
    console.log('🔑 Adding service account credentials to pool projects...');

    // Get the main service account credentials from environment
    const mainServiceAccount = {
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
    };

    if (!mainServiceAccount.clientEmail || !mainServiceAccount.privateKey) {
      return NextResponse.json(
        { error: 'Main service account credentials not found in environment' },
        { status: 400 }
      );
    }

    const poolProjects = ['chatfactory-pool-001', 'chatfactory-pool-002', 'chatfactory-pool-003'];
    const batch = adminDb.batch();
    let updatedCount = 0;

    for (const projectId of poolProjects) {
      const projectRef = adminDb.collection('firebaseProjects').doc(projectId);
      const doc = await projectRef.get();

      if (doc.exists) {
        const data = doc.data();

        if (!data?.serviceAccount) {
          console.log(`🔑 Adding service account to ${projectId}`);

          batch.update(projectRef, {
            serviceAccount: {
              type: 'service_account',
              project_id: projectId,
              client_email: mainServiceAccount.clientEmail,
              private_key: mainServiceAccount.privateKey,
              // Note: Using main service account for all pool projects
              // In production, you might want unique service accounts per project
            },
            updatedAt: Timestamp.now()
          });

          updatedCount++;
        } else {
          console.log(`ℹ️ ${projectId} already has service account`);
        }
      } else {
        console.log(`⚠️ ${projectId} not found`);
      }
    }

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`✅ Added service accounts to ${updatedCount} pool projects`);
    }

    return NextResponse.json({
      message: `Added service accounts to ${updatedCount} pool projects`,
      updated: updatedCount,
      note: 'Using main service account credentials for pool projects'
    });

  } catch (error: any) {
    console.error('❌ Error adding service accounts:', error);
    return NextResponse.json(
      { error: 'Failed to add service accounts', details: error.message },
      { status: 500 }
    );
  }
}