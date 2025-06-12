import { NextRequest, NextResponse } from 'next/server';
import { PineconeService } from '@/services/pineconeService';
import { DatabaseService } from '@/services/databaseService';
import { FirebaseProjectService } from '@/services/firebaseProjectService';
import { ReusableFirebaseProjectService } from '@/services/reusableFirebaseProjectService';

const USE_REUSABLE_FIREBASE_PROJECT = process.env.USE_REUSABLE_FIREBASE_PROJECT === 'true';

export async function DELETE(request: NextRequest) {
  try {
    const { chatbotId, userId, deleteVectorstore = false, deleteFirebaseProject = true } = await request.json();

    if (!chatbotId) {
      return NextResponse.json({ error: 'Missing chatbotId' }, { status: 400 });
    }

    const results = { 
      vectorstoreDeleted: false, 
      userUpdated: false, 
      firebaseProjectDeleted: false,
      firebaseProjectAutomated: false,
      errors: [] as string[] 
    };

    // Delete vectorstore if requested
    if (deleteVectorstore) {
      console.log('🗑️ Deleting Pinecone vectorstore...');
      const result = await PineconeService.deleteIndex(chatbotId);
      results.vectorstoreDeleted = result.success;
      if (!result.success) results.errors.push(`Vectorstore: ${result.error}`);
    }

    // Delete or clean up Firebase project if requested (default: true)
    if (deleteFirebaseProject) {
      if (USE_REUSABLE_FIREBASE_PROJECT) {
        console.log('🧹 Cleaning up reusable Firebase project data...');
        const cleanupResult = await ReusableFirebaseProjectService.cleanupChatbotData(
          chatbotId,
          userId || ''
        );
        results.firebaseProjectDeleted = cleanupResult.success;
        if (!cleanupResult.success) {
          results.errors.push(`Reusable Firebase cleanup: ${cleanupResult.message}`);
        }
      } else {
        console.log('🗑️ Deleting GCP/Firebase project...');
        const result = await FirebaseProjectService.deleteProject(chatbotId);
        results.firebaseProjectDeleted = result.success;
        results.firebaseProjectAutomated = result.automated || false;
        if (!result.success) {
          results.errors.push(`Firebase Project: ${result.error}`);
        } else if (!result.automated) {
          // If deletion succeeded but wasn't automated, add as warning
          results.errors.push(`Firebase Project: ${result.error || 'Manual deletion required'}`);
        }
      }
    }

    // Update user stats
    if (userId) {
      console.log('📊 Updating user deployment stats...');
      const result = await DatabaseService.deleteUserDeployment(userId);
      results.userUpdated = result.success;
      if (!result.success) results.errors.push(`User stats: ${result.error}`);
    }

    // Determine overall success
    const hasErrors = results.errors.length > 0;
    const hasSuccessfulOperations = results.vectorstoreDeleted || results.firebaseProjectDeleted || results.userUpdated;

    return NextResponse.json({
      success: hasSuccessfulOperations,
      results,
      warnings: hasErrors ? results.errors : undefined,
      message: hasErrors ? 
        'Some operations completed with warnings. Check results for details.' : 
        'All requested operations completed successfully.'
    });

  } catch (error) {
    console.error('❌ Chatbot deletion error:', error);
    return NextResponse.json({
      error: 'Deletion failed',
      details: error instanceof Error ? error.message : 'Unknown'
    }, { status: 500 });
  }
}
