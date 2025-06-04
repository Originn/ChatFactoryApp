import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import { FirebaseProjectService } from '@/services/firebaseProjectService';

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
      console.log('🗑️ Deleting Firebase project via API for chatbot:', chatbotId);
      
      // Note: This marks the project as deleted in our database
      // Actual Google Cloud project deletion would require additional setup
      const result = await FirebaseProjectService.deleteProject(chatbotId);

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Firebase project deleted successfully'
        });
      } else {
        return NextResponse.json({
          success: false,
          error: result.error
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
