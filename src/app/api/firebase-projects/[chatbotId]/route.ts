import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { FirebaseProjectService } from '@/services/firebaseProjectService';
import { ReusableFirebaseProjectService } from '@/services/reusableFirebaseProjectService';

// REUSABLE FIREBASE PROJECT CONFIGURATION
const USE_REUSABLE_FIREBASE_PROJECT = process.env.USE_REUSABLE_FIREBASE_PROJECT === 'true';

export async function GET(
  request: NextRequest,
  { params }: { params: { chatbotId: string } }
) {
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const { chatbotId } = params;

    // Get Firebase project for chatbot
    const project = await FirebaseProjectService.getProjectForChatbot(chatbotId);
    
    if (!project) {
      return NextResponse.json({ 
        success: false,
        error: 'No Firebase project found for this chatbot' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      project
    });

  } catch (error: any) {
    console.error('Get Firebase project error:', error);
    return NextResponse.json({ 
      error: `Failed to get Firebase project: ${error.message}` 
    }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { chatbotId: string } }
) {
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const { chatbotId } = params;
    const body = await request.json();
    const { chatbotName, action } = body;

    if (action === 'create') {
      console.log('🔥 Creating Firebase project via API for chatbot:', chatbotId);
      
      const result = await FirebaseProjectService.createProjectForChatbot({
        chatbotId,
        chatbotName,
        creatorUserId: userId
      });

      if (result.success) {
        return NextResponse.json({
          success: true,
          project: result.project,
          message: 'Firebase project created successfully'
        });
      } else {
        return NextResponse.json({
          success: false,
          error: result.error
        }, { status: 500 });
      }
    }

    if (action === 'delete') {
      console.log('🗑️ Processing Firebase project deletion for chatbot:', chatbotId);
      console.log('🔍 Reusable Firebase project mode:', USE_REUSABLE_FIREBASE_PROJECT ? 'ENABLED' : 'DISABLED');
      
      if (USE_REUSABLE_FIREBASE_PROJECT) {
        console.log('🧹 Using reusable Firebase project cleanup instead of deletion');
        
        // Check if this is a request for complete factory reset
        const { factoryReset } = await request.json().catch(() => ({}));
        
        if (factoryReset) {
          console.log('🏭 FACTORY RESET requested - wiping entire project!');
          
          try {
            const resetResult = await ReusableFirebaseProjectService.factoryResetProject();
            
            if (resetResult.success) {
              return NextResponse.json({
                success: true,
                message: 'Complete factory reset completed successfully',
                details: resetResult.details,
                resetMode: true,
                warning: 'ALL data, users, and credentials have been wiped from the project'
              });
            } else {
              return NextResponse.json({
                success: false,
                error: `Factory reset failed: ${resetResult.message}`,
                details: resetResult.details
              }, { status: 500 });
            }
          } catch (resetError: any) {
            console.error('❌ Error during factory reset:', resetError);
            return NextResponse.json({
              success: false,
              error: `Factory reset error: ${resetError.message}`
            }, { status: 500 });
          }
          
        } else {
          console.log('🧹 Regular chatbot cleanup (preserves other data)');
          
          try {
            // Use the cleanup service for reusable Firebase projects  
            const cleanupResult = await ReusableFirebaseProjectService.cleanupChatbotData(chatbotId, userId);
            
            if (cleanupResult.success) {
              return NextResponse.json({
                success: true,
                message: 'Reusable Firebase project cleaned successfully',
                details: cleanupResult.details,
                cleanupMode: true
              });
            } else {
              return NextResponse.json({
                success: false,
                error: `Reusable Firebase project cleanup failed: ${cleanupResult.message}`,
                details: cleanupResult.details
              }, { status: 500 });
            }
          } catch (cleanupError: any) {
            console.error('❌ Error during reusable Firebase project cleanup:', cleanupError);
            return NextResponse.json({
              success: false,
              error: `Reusable Firebase project cleanup error: ${cleanupError.message}`
            }, { status: 500 });
          }
        }
        
      } else {
        console.log('🗑️ Using regular Firebase project deletion');
        
        const result = await FirebaseProjectService.deleteProject(chatbotId);

        if (result.success) {
          return NextResponse.json({
            success: true,
            automated: result.automated,
            message: result.automated ? 
              'Firebase project deleted successfully using GCP SDK' : 
              'Firebase project marked for deletion - manual cleanup may be required',
            details: result.error || undefined
          });
        } else {
          return NextResponse.json({
            success: false,
            error: result.error
          }, { status: 500 });
        }
      }
    }

    if (action === 'test-permissions') {
      console.log('🧪 Testing GCP project deletion permissions...');
      
      try {
        // Import the Google Cloud Resource Manager client
        const { ProjectsClient } = require('@google-cloud/resource-manager').v3;
        
        // Initialize the client with credentials
        const credentials = FirebaseProjectService['getGoogleCloudCredentials']();
        const projectsClient = new ProjectsClient(credentials ? { credentials } : {});

        // Test by listing projects (requires basic permissions)
        const [projects] = await projectsClient.searchProjects({});
        
        return NextResponse.json({
          success: true,
          message: 'GCP Resource Manager client initialized successfully',
          projectCount: projects.length,
          hasCredentials: !!credentials,
          testPassed: true
        });
        
      } catch (error: any) {
        return NextResponse.json({
          success: false,
          error: `Permission test failed: ${error.message}`,
          testPassed: false
        }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      error: 'Invalid action. Supported actions: create, delete' 
    }, { status: 400 });

  } catch (error: any) {
    console.error('Firebase project API error:', error);
    return NextResponse.json({ 
      error: `Failed to process request: ${error.message}` 
    }, { status: 500 });
  }
}
