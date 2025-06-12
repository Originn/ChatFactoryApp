import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import * as admin from 'firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword, email } = await request.json();

    if (!token || !newPassword || !email) {
      return NextResponse.json(
        { error: 'Token, password, and email are required' },
        { status: 400 }
      );
    }

    console.log('🔧 Processing password setup for token:', token);

    // Get token data from main project (tokens are stored in main project for admin access)
    const tokenDoc = await adminDb
      .collection('passwordResetTokens')
      .doc(token)
      .get();

    if (!tokenDoc.exists) {
      return NextResponse.json(
        { error: 'Invalid or expired setup link' },
        { status: 400 }
      );
    }

    const tokenData = tokenDoc.data();

    // Verify token is valid
    if (tokenData?.used || tokenData?.expiresAt?.toDate() < new Date()) {
      return NextResponse.json(
        { error: 'Setup link has expired or already been used' },
        { status: 400 }
      );
    }

    if (tokenData?.email !== email) {
      return NextResponse.json(
        { error: 'Email mismatch' },
        { status: 400 }
      );
    }

    const chatbotId = tokenData?.chatbotId;
    if (!chatbotId) {
      return NextResponse.json(
        { error: 'Invalid setup link - no chatbot ID' },
        { status: 400 }
      );
    }

    // Get the dedicated project info from the chatbot document
    const chatbotDoc = await adminDb
      .collection('chatbots')
      .doc(chatbotId)
      .get();

    if (!chatbotDoc.exists) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      );
    }

    const chatbotData = chatbotDoc.data();
    const dedicatedProjectId = chatbotData?.deployment?.firebaseProjectId;

    if (!dedicatedProjectId) {
      return NextResponse.json(
        { error: 'Dedicated Firebase project not configured for this chatbot' },
        { status: 500 }
      );
    }

    // Initialize Firebase app for the dedicated project
    const chatbotAppName = `chatbot-${chatbotId}`;
    let chatbotApp: admin.app.App;

    try {
      chatbotApp = admin.app(chatbotAppName);
    } catch (error) {
      chatbotApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: dedicatedProjectId
      }, chatbotAppName);
    }

    // Update the user's password in the dedicated project using Admin SDK
    try {
      const dedicatedAuth = chatbotApp.auth();
      const userRecord = await dedicatedAuth.getUserByEmail(email);
      
      await dedicatedAuth.updateUser(userRecord.uid, {
        password: newPassword
      });

      console.log('✅ Password updated successfully for user:', userRecord.uid);

      return NextResponse.json({
        success: true,
        message: 'Password updated successfully'
      });

    } catch (updateError: any) {
      console.error('❌ Error updating password:', updateError);
      
      if (updateError.code === 'auth/user-not-found') {
        return NextResponse.json(
          { error: 'User account not found' },
          { status: 404 }
        );
      } else if (updateError.code === 'auth/weak-password') {
        return NextResponse.json(
          { error: 'Password is too weak. Please choose a stronger password.' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('❌ Password setup API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
