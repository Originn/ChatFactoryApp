import { NextRequest, NextResponse } from 'next/server';
import { FirebaseTenantService } from '@/services/firebaseTenantService';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { action, chatbotId, email, displayName, userId } = await request.json();

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

        const tenantId = chatbotData.authConfig?.firebaseTenantId;
        if (!tenantId) {
          return NextResponse.json({ error: 'Firebase tenant not found. Please redeploy the chatbot.' }, { status: 400 });
        }

        const inviteResult = await FirebaseTenantService.inviteUser({
          chatbotId,
          tenantId,
          email,
          displayName,
          creatorUserId: chatbotData.userId
        });

        if (!inviteResult.success) {
          return NextResponse.json({ error: inviteResult.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          message: `Invitation sent to ${email}`,
          userId: inviteResult.userId
        });

      case 'remove':
        if (!userId) {
          return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const removeResult = await FirebaseTenantService.removeUser(chatbotId, userId);

        if (!removeResult.success) {
          return NextResponse.json({ error: removeResult.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          message: 'User removed successfully'
        });

      case 'list':
        const invitedUsers = chatbotData.authConfig?.invitedUsers || [];
        return NextResponse.json({
          success: true,
          users: invitedUsers
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

    // Get chatbot and return invited users
    const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();
    if (!chatbotDoc.exists) {
      return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 });
    }

    const chatbotData = chatbotDoc.data();
    const invitedUsers = chatbotData?.authConfig?.invitedUsers || [];

    return NextResponse.json({
      success: true,
      users: invitedUsers,
      tenantId: chatbotData?.authConfig?.firebaseTenantId
    });

  } catch (error: any) {
    console.error('Get chatbot users error:', error);
    return NextResponse.json({ 
      error: `Failed to get users: ${error.message}` 
    }, { status: 500 });
  }
}
