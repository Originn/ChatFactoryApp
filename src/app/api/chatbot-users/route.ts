import { NextRequest, NextResponse } from 'next/server';
import { ChatbotFirebaseService } from '@/services/chatbotFirebaseService';
import { adminDb } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { action, chatbotId, email, displayName, userId, role, firebaseUid } = await request.json();

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

      case 'restore':
        if (!userId) {
          return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const restoreResult = await ChatbotFirebaseService.restoreUser({
          chatbotId,
          userId,
          firebaseUid,
          email
        });

        if (!restoreResult.success) {
          return NextResponse.json({ error: restoreResult.error }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          message: 'User access restored successfully'
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
    const includeSignedIn = searchParams.get('includeSignedIn') === 'true';

    if (!chatbotId) {
      return NextResponse.json({ error: 'Missing chatbot ID' }, { status: 400 });
    }

    // Get invited users from main project
    const invitedUsersResult = await ChatbotFirebaseService.getChatbotUsers(chatbotId);

    if (!invitedUsersResult.success) {
      return NextResponse.json({ error: invitedUsersResult.error }, { status: 500 });
    }

    const invitedUsers = invitedUsersResult.users || [];

    // If not requesting signed-in users, return just invited users (backwards compatible)
    if (!includeSignedIn) {
      return NextResponse.json({
        success: true,
        users: invitedUsers
      });
    }

    // Get signed-in users from dedicated Firebase Auth
    const signedInUsersResult = await ChatbotFirebaseService.getSignedInUsers(chatbotId);

    if (!signedInUsersResult.success) {
      console.warn('Failed to get signed-in users:', signedInUsersResult.error);
      // Continue with invited users only if signed-in fetch fails
      return NextResponse.json({
        success: true,
        users: invitedUsers,
        warning: 'Could not fetch signed-in users from Firebase Auth'
      });
    }

    const signedInUsers = signedInUsersResult.users || [];

    // Merge and deduplicate users by email
    const userMap = new Map();

    // Add invited users first
    invitedUsers.forEach(user => {
      userMap.set(user.email.toLowerCase(), {
        ...user,
        source: 'invited',
        isInvited: true,
        hasSignedIn: false,
        firebaseUid: user.dedicatedProjectUserId
      });
    });

    // Merge with signed-in users
    signedInUsers.forEach(authUser => {
      const email = authUser.email.toLowerCase();
      const existingUser = userMap.get(email);

      if (existingUser) {
        // User exists in both - merge data
        userMap.set(email, {
          ...existingUser,
          source: 'both',
          hasSignedIn: true,
          lastSignInAt: authUser.lastSignInAt,
          emailVerified: authUser.emailVerified,
          disabled: authUser.disabled,
          firebaseUid: authUser.id,
          // Override status based on Firebase Auth data
          status: authUser.disabled ? 'disabled' :
                 authUser.emailVerified ? 'active' : 'pending'
        });
      } else {
        // User only exists in Firebase Auth (signed up directly)
        userMap.set(email, {
          id: authUser.id,
          email: authUser.email,
          displayName: authUser.displayName,
          chatbotId: chatbotId,
          role: 'user',
          status: authUser.disabled ? 'disabled' :
                  authUser.emailVerified ? 'active' : 'pending',
          invitedAt: authUser.createdAt,
          invitedBy: 'self-signup',
          emailVerified: authUser.emailVerified,
          lastSignInAt: authUser.lastSignInAt,
          createdAt: authUser.createdAt,
          updatedAt: authUser.createdAt,
          source: 'signed-in',
          isInvited: false,
          hasSignedIn: true,
          firebaseUid: authUser.id
        });
      }
    });

    // Convert map to array and sort by last activity
    const allUsers = Array.from(userMap.values()).sort((a, b) => {
      const aTime = a.lastSignInAt || a.invitedAt || a.createdAt;
      const bTime = b.lastSignInAt || b.invitedAt || b.createdAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    return NextResponse.json({
      success: true,
      users: allUsers,
      stats: {
        total: allUsers.length,
        invited: invitedUsers.length,
        signedIn: signedInUsers.length,
        both: allUsers.filter(u => u.source === 'both').length
      }
    });

  } catch (error: any) {
    console.error('Get chatbot users error:', error);
    return NextResponse.json({
      error: `Failed to get users: ${error.message}`
    }, { status: 500 });
  }
}
