import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin/index';

/**
 * Manual cleanup endpoint to remove leftover chatbot data
 * Use this to clean up any data left behind from previous deletions
 */
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
    const { confirmToken, targetChatbotId } = body;

    // Safety check - require confirmation token
    if (confirmToken !== 'CLEANUP_LEFTOVERS_CONFIRMED') {
      return NextResponse.json({
        error: 'Invalid confirmation token. This operation requires explicit confirmation.'
      }, { status: 400 });
    }

    console.log('🧹 Starting manual cleanup of leftover chatbot data...');

    const cleanupResults = {
      chatbotVerificationTokens: 0,
      processedYoutubeVideos: 0,
      orphanedMessages: 0,
      orphanedDocuments: 0,
      totalCleaned: 0
    };

    // Get list of current valid chatbot IDs
    const chatbotsSnapshot = await adminDb.collection('chatbots').get();
    const validChatbotIds = new Set(chatbotsSnapshot.docs.map(doc => doc.id));

    console.log(`📋 Found ${validChatbotIds.size} valid chatbots`);

    // Clean up chatbot_verification_tokens
    console.log('🧹 Cleaning chatbot_verification_tokens...');
    try {
      const verificationTokensSnapshot = await adminDb.collection('chatbot_verification_tokens').get();
      const batch1 = adminDb.batch();
      let count1 = 0;

      verificationTokensSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (targetChatbotId) {
          // Clean specific chatbot
          if (data.chatbotId === targetChatbotId) {
            batch1.delete(doc.ref);
            count1++;
          }
        } else {
          // Clean orphaned tokens (chatbot doesn't exist)
          if (data.chatbotId && !validChatbotIds.has(data.chatbotId)) {
            batch1.delete(doc.ref);
            count1++;
          }
        }
      });

      if (count1 > 0) {
        await batch1.commit();
        cleanupResults.chatbotVerificationTokens = count1;
        console.log(`✅ Cleaned ${count1} orphaned verification tokens`);
      }
    } catch (error) {
      console.error('❌ Error cleaning verification tokens:', error);
    }

    // Clean up processed_youtube_videos
    console.log('🧹 Cleaning processed_youtube_videos...');
    try {
      const youtubeSnapshot = await adminDb.collection('processed_youtube_videos').get();
      const batch2 = adminDb.batch();
      let count2 = 0;

      youtubeSnapshot.docs.forEach(doc => {
        const docId = doc.id;
        const chatbotId = docId.split('_')[0]; // Format: chatbotId_videoId

        if (targetChatbotId) {
          // Clean specific chatbot
          if (chatbotId === targetChatbotId) {
            batch2.delete(doc.ref);
            count2++;
          }
        } else {
          // Clean orphaned videos
          if (chatbotId && !validChatbotIds.has(chatbotId)) {
            batch2.delete(doc.ref);
            count2++;
          }
        }
      });

      if (count2 > 0) {
        await batch2.commit();
        cleanupResults.processedYoutubeVideos = count2;
        console.log(`✅ Cleaned ${count2} orphaned YouTube video records`);
      }
    } catch (error) {
      console.error('❌ Error cleaning YouTube videos:', error);
    }

    // Clean up orphaned messages
    console.log('🧹 Cleaning orphaned messages...');
    try {
      const messagesSnapshot = await adminDb.collection('messages')
        .limit(1000) // Process in batches
        .get();

      const batch3 = adminDb.batch();
      let count3 = 0;

      messagesSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (targetChatbotId) {
          // Clean specific chatbot
          if (data.chatbotId === targetChatbotId) {
            batch3.delete(doc.ref);
            count3++;
          }
        } else {
          // Clean orphaned messages
          if (data.chatbotId && !validChatbotIds.has(data.chatbotId)) {
            batch3.delete(doc.ref);
            count3++;
          }
        }
      });

      if (count3 > 0) {
        await batch3.commit();
        cleanupResults.orphanedMessages = count3;
        console.log(`✅ Cleaned ${count3} orphaned messages`);
      }
    } catch (error) {
      console.error('❌ Error cleaning messages:', error);
    }

    // Clean up orphaned documents
    console.log('🧹 Cleaning orphaned documents...');
    try {
      const documentsSnapshot = await adminDb.collection('documents')
        .limit(1000) // Process in batches
        .get();

      const batch4 = adminDb.batch();
      let count4 = 0;

      documentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (targetChatbotId) {
          // Clean specific chatbot
          if (data.chatbotId === targetChatbotId) {
            batch4.delete(doc.ref);
            count4++;
          }
        } else {
          // Clean orphaned documents
          if (data.chatbotId && !validChatbotIds.has(data.chatbotId)) {
            batch4.delete(doc.ref);
            count4++;
          }
        }
      });

      if (count4 > 0) {
        await batch4.commit();
        cleanupResults.orphanedDocuments = count4;
        console.log(`✅ Cleaned ${count4} orphaned documents`);
      }
    } catch (error) {
      console.error('❌ Error cleaning documents:', error);
    }

    cleanupResults.totalCleaned =
      cleanupResults.chatbotVerificationTokens +
      cleanupResults.processedYoutubeVideos +
      cleanupResults.orphanedMessages +
      cleanupResults.orphanedDocuments;

    console.log(`✅ Manual cleanup completed! Total cleaned: ${cleanupResults.totalCleaned} items`);

    return NextResponse.json({
      success: true,
      message: `Manual cleanup completed! Cleaned ${cleanupResults.totalCleaned} leftover items.`,
      results: cleanupResults,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Manual cleanup error:', error);
    return NextResponse.json({
      error: `Manual cleanup failed: ${error.message}`
    }, { status: 500 });
  }
}