import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

interface InviteUserRequest {
  chatbotId: string;
  email: string;
  displayName?: string;
  creatorUserId: string;
  role?: 'user' | 'admin';
}

interface ChatbotUserProfile {
  id: string;
  email: string;
  displayName?: string;
  chatbotId: string;
  role: 'user' | 'admin';
  status: 'pending' | 'active' | 'disabled';
  invitedAt: Date;
  invitedBy: string;
  emailVerified: boolean;
  lastSignInAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

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

        // TEMPORARY FIX: Store user in main database until deployment is fixed
        const userProfile: ChatbotUserProfile = {
          id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          email,
          displayName: displayName || email.split('@')[0],
          chatbotId,
          role: role || 'user',
          status: 'pending',
          invitedAt: new Date(),
          invitedBy: chatbotData.userId,
          emailVerified: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Store in main database for now
        await adminDb
          .collection('chatbot_users_temp')
          .doc(userProfile.id)
          .set(userProfile);

        return NextResponse.json({
          success: true,
          message: `User ${email} has been added to the chatbot. Note: This is a temporary solution until the chatbot is properly deployed.`,
          userId: userProfile.id
        });

      case 'remove':
        if (!userId) {
          return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // Remove from temporary storage
        await adminDb
          .collection('chatbot_users_temp')
          .doc(userId)
          .update({
            status: 'disabled',
            updatedAt: new Date()
          });

        return NextResponse.json({
          success: true,
          message: 'User access revoked successfully'
        });

      case 'list':
        // Get users from temporary storage - SIMPLIFIED QUERY (no compound index needed)
        const usersSnapshot = await adminDb
          .collection('chatbot_users_temp')
          .where('chatbotId', '==', chatbotId)
          .get();

        // Filter out disabled users in JavaScript instead of Firestore query
        const users = usersSnapshot.docs
          .map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id,
              // Convert timestamps if they're Firestore timestamps
              createdAt: data.createdAt?.toDate?.() || data.createdAt,
              updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
              invitedAt: data.invitedAt?.toDate?.() || data.invitedAt,
              lastSignInAt: data.lastSignInAt?.toDate?.() || data.lastSignInAt,
            };
          })
          .filter(user => user.status !== 'disabled'); // Filter in JavaScript

        return NextResponse.json({
          success: true,
          users: users,
          note: 'These users are stored temporarily until the chatbot is properly deployed'
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

    // Get users from temporary storage - SIMPLIFIED QUERY (no compound index needed)
    const usersSnapshot = await adminDb
      .collection('chatbot_users_temp')
      .where('chatbotId', '==', chatbotId)
      .get();

    // Filter out disabled users in JavaScript instead of Firestore query
    const users = usersSnapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          // Convert timestamps if they're Firestore timestamps
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
          invitedAt: data.invitedAt?.toDate?.() || data.invitedAt,
          lastSignInAt: data.lastSignInAt?.toDate?.() || data.lastSignInAt,
        };
      })
      .filter(user => user.status !== 'disabled'); // Filter in JavaScript

    return NextResponse.json({
      success: true,
      users: users,
      note: 'These users are stored temporarily until the chatbot is properly deployed'
    });

  } catch (error: any) {
    console.error('Get chatbot users error:', error);
    return NextResponse.json({ 
      error: `Failed to get users: ${error.message}` 
    }, { status: 500 });
  }
}
