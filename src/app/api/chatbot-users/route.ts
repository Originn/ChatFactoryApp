import { NextRequest, NextResponse } from 'next/server';
import { ChatbotFirebaseService } from '@/services/chatbotFirebaseService';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { action, chatbotId, email, displayName, userId, role } = await request.json();

    if (!chatbotId) {
      return NextResponse.json({ error: 'Missing chatbot ID' }, { status: 400 });
    }

    // Verify chatbot exists and get user permissions
    const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
    if (!chatbotDoc.exists) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    const chatbotData = chatbotDoc.data();
    
    if (!chatbotData?.requireAuth) {
      return NextResponse.json({ error: 'Authentication not enabled for this chatbot' }, { status: 400 });
    }

    switch (action) {
      case 'invite':
        if (!email) {
          return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const inviteResult = await ChatbotFirebaseService.inviteUser({
          chatbotId,
          email,
          displayName,
          creatorUserId: chatbotData.userId,
          role: role || 'user'
        });

        if (!inviteResult.success) {
          return NextResponse.json({ error: inviteResult.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          message: `Invitation sent to ${email}. They will receive an email with verification instructions.`,
          userId: inviteResult.userId
        });

      case 'remove':
        if (!userId) {
          return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const removeResult = await ChatbotFirebaseService.removeUser({
          chatbotId,
          userId
        });

        if (!removeResult.success) {
          return NextResponse.json({ error: removeResult.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          message: 'User access revoked successfully'
        });

      case 'list':
        const usersResult = await ChatbotFirebaseService.getChatbotUsers(chatbotId);
        
        if (!usersResult.success) {
          return NextResponse.json({ error: usersResult.error }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          users: usersResult.users || []
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Chatbot users API error:', error);
    return NextResponse.json({ 
      error: `Failed to manage users: ${error.message}` 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chatbotId = searchParams.get('chatbotId');

    if (!chatbotId) {
      return NextResponse.json({ error: 'Missing chatbot ID' }, { status: 400 });
    }

    // Get users for the chatbot from its dedicated Firebase project
    const usersResult = await ChatbotFirebaseService.getChatbotUsers(chatbotId);
    
    if (!usersResult.success) {
      return NextResponse.json({ error: usersResult.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      users: usersResult.users || []
    });

  } catch (error: any) {
    console.error('Get chatbot users error:', error);
    return NextResponse.json({ 
      error: `Failed to get users: ${error.message}` 
    }, { status: 500 });
  }
}
