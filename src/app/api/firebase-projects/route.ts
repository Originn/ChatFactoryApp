import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin/index';
import { FirebaseProjectService } from '@/services/firebaseProjectService';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching all Firebase projects...');

    // Get all Firebase projects from Firestore
    const projectsSnapshot = await adminDb.collection('firebaseProjects').get();

    const projects = projectsSnapshot.docs.map(doc => ({
      projectId: doc.id,
      ...doc.data()
    }));

    console.log(`✅ Found ${projects.length} Firebase projects`);

    return NextResponse.json({
      success: true,
      projects
    });

  } catch (error: any) {
    console.error('❌ Error fetching Firebase projects:', error);
    return NextResponse.json({
      error: `Failed to fetch projects: ${error.message}`
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ error: 'No authorization token provided' }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const body = await request.json();
    const { chatbotId, chatbotName, action } = body;

    if (!chatbotId || !chatbotName) {
      return NextResponse.json({ 
        error: 'Missing required fields: chatbotId, chatbotName' 
      }, { status: 400 });
    }
    switch (action) {
      case 'create':
        console.log('🔥 Creating Firebase project for chatbot:', chatbotId);
        
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

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Supported actions: create' 
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Firebase projects API error:', error);
    return NextResponse.json({ 
      error: `Failed to process request: ${error.message}` 
    }, { status: 500 });
  }
}