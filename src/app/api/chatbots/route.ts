import { NextRequest, NextResponse } from 'next/server';
import { PineconeService } from '@/services/pineconeService';
import { DatabaseService } from '@/services/databaseService';
import { FirebaseProjectService } from '@/services/firebaseProjectService';
import { ReusableFirebaseProjectService } from '@/services/reusableFirebaseProjectService';
import { ProjectMappingService } from '@/services/projectMappingService';

const USE_REUSABLE_FIREBASE_PROJECT = process.env.USE_REUSABLE_FIREBASE_PROJECT === 'true';

export async function DELETE(request: NextRequest) {
  try {
    console.log('🗑️ Starting chatbot deletion via legacy API...');
    const { chatbotId, userId, deleteVectorstore = false, deleteFirebaseProject = true } = await request.json();

    if (!chatbotId) {
      console.error('❌ Missing chatbotId in request');
      return NextResponse.json({ error: 'Missing chatbotId' }, { status: 400 });
    }

    console.log(`📋 Deletion request: chatbotId=${chatbotId}, userId=${userId}, deleteVectorstore=${deleteVectorstore}, deleteFirebaseProject=${deleteFirebaseProject}`);

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
      try {
        // Check project mapping to determine the best deletion strategy
        console.log('🔍 Determining project deletion strategy...');

        // Get all projects to find the one for this chatbot
        console.log('📊 Fetching all project mappings...');
        const allProjects = await ProjectMappingService.getAllProjects();
        console.log(`📊 Found ${allProjects.length} project mappings`);

        const chatbotProject = allProjects.find(p => p.chatbotId === chatbotId);
        console.log(`🎯 Chatbot project mapping: ${chatbotProject ? `${chatbotProject.projectId} (${chatbotProject.projectType})` : 'not found'}`);

      if (chatbotProject) {
        console.log(`📋 Found project mapping: ${chatbotProject.projectId} (type: ${chatbotProject.projectType})`);

        if (chatbotProject.projectType === 'pool') {
          console.log('♻️ Using reusable project cleanup for pool project...');
          const cleanupResult = await ReusableFirebaseProjectService.cleanupChatbotData(
            chatbotId,
            userId || ''
          );
          results.firebaseProjectDeleted = cleanupResult.success;
          if (!cleanupResult.success) {
            results.errors.push(`Reusable Firebase cleanup: ${cleanupResult.message}`);
          }

          // Release the pool project back to available status
          console.log('🔄 Releasing pool project back to available state...');
          const releaseResult = await ProjectMappingService.releaseProject(chatbotProject.projectId, chatbotId);

          if (releaseResult.success) {
            console.log(`✅ Successfully released project ${chatbotProject.projectId}`);
          } else {
            results.errors.push(`Failed to release project: ${releaseResult.message}`);
            console.error(`❌ Project release failed: ${releaseResult.message}`);
          }
        } else {
          console.log('🗑️ Using dedicated project deletion for dedicated project...');
          const result = await FirebaseProjectService.deleteProject(chatbotId);
          results.firebaseProjectDeleted = result.success;
          results.firebaseProjectAutomated = result.automated || false;
          if (!result.success) {
            results.errors.push(`Firebase Project: ${result.error}`);
          } else if (!result.automated) {
            results.errors.push(`Firebase Project: ${result.error || 'Manual deletion required'}`);
          }
        }
      } else {
        // Fallback to environment variable logic if no project mapping found
        console.log('⚠️ No project mapping found, using environment variable logic');

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

          // Try to find and release any pool project for this chatbot
          console.log('🔍 Attempting to find and release pool project for chatbot...');
          try {
            const allProjects = await ProjectMappingService.getAllProjects();
            const chatbotPoolProject = allProjects.find(p => p.chatbotId === chatbotId && p.projectType === 'pool');

            if (chatbotPoolProject) {
              console.log(`🔄 Found pool project ${chatbotPoolProject.projectId}, releasing...`);
              const releaseResult = await ProjectMappingService.releaseProject(chatbotPoolProject.projectId, chatbotId);

              if (releaseResult.success) {
                console.log(`✅ Successfully released project ${chatbotPoolProject.projectId}`);
              } else {
                console.error(`❌ Project release failed: ${releaseResult.message}`);
              }
            } else {
              console.log('ℹ️ No pool project found for this chatbot');
            }
          } catch (releaseError: any) {
            console.error('❌ Error finding/releasing pool project:', releaseError);
          }
        } else {
          console.log('🗑️ Deleting GCP/Firebase project...');
          const result = await FirebaseProjectService.deleteProject(chatbotId);
          results.firebaseProjectDeleted = result.success;
          results.firebaseProjectAutomated = result.automated || false;
          if (!result.success) {
            results.errors.push(`Firebase Project: ${result.error}`);
          } else if (!result.automated) {
            results.errors.push(`Firebase Project: ${result.error || 'Manual deletion required'}`);
          }
        }
        }
      } catch (firebaseError: any) {
        console.error('Error in Firebase project deletion strategy:', firebaseError);
        results.errors.push(`Firebase deletion error: ${firebaseError.message}`);
        results.firebaseProjectDeleted = false;
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
