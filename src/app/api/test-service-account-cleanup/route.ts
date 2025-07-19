// app/api/test-service-account-cleanup/route.ts  
// TEST ENDPOINT - Clean up service accounts completely (for testing the fix)

import { NextRequest, NextResponse } from 'next/server';
import { ReusableFirebaseProjectService } from '../../../services/reusableFirebaseProjectService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, projectId, chatbotId, userId } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    switch (action) {
      case 'deleteAllChatbotServiceAccounts':
        console.log(`🧪 TEST: Deleting all chatbot service accounts in ${projectId}`);
        await ReusableFirebaseProjectService.deleteAllChatbotServiceAccounts(projectId);
        return NextResponse.json({
          success: true,
          message: `All chatbot service accounts deleted from ${projectId}`,
          action: 'deleteAllChatbotServiceAccounts'
        });

      case 'cleanupChatbot':
        if (!chatbotId || !userId) {
          return NextResponse.json({ 
            error: 'chatbotId and userId required for chatbot cleanup' 
          }, { status: 400 });
        }

        console.log(`🧪 TEST: Cleaning up chatbot ${chatbotId} for user ${userId}`);
        // Set REUSABLE_FIREBASE_PROJECT_ID temporarily for the test
        process.env.REUSABLE_FIREBASE_PROJECT_ID = projectId;
        
        const result = await ReusableFirebaseProjectService.cleanupChatbotData(chatbotId, userId, true);
        return NextResponse.json({
          success: result.success,
          message: result.message,
          details: result.details,
          action: 'cleanupChatbot'
        });

      default:
        return NextResponse.json({ 
          error: 'Invalid action',
          validActions: ['deleteAllChatbotServiceAccounts', 'cleanupChatbot']
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error('❌ Test cleanup failed:', error);
    
    return NextResponse.json({
      error: 'Cleanup failed',
      message: error.message
    }, { status: 500 });
  }
}

/* 
Usage Examples:

1. Delete all chatbot service accounts in a project:
POST /api/test-service-account-cleanup
{
  "action": "deleteAllChatbotServiceAccounts",
  "projectId": "my-dev-chatbot-firebase"
}

2. Clean up specific chatbot (new method with complete service account deletion):
POST /api/test-service-account-cleanup  
{
  "action": "cleanupChatbot",
  "projectId": "my-dev-chatbot-firebase",
  "chatbotId": "Q6MZRW6HTDCu0h1foj7c", 
  "userId": "user123"
}

Expected new logs:
🗑️ Deleting chatbot service account: mydevchatbotfirebase-admin@my-dev-chatbot-firebase.iam.gserviceaccount.com
🔑 Deleting all 2 keys for mydevchatbotfirebase-admin@my-dev-chatbot-firebase.iam.gserviceaccount.com
✅ Deleted key: e8e60bd930845171b468435945668c747c26ceef
✅ Deleted key: [another-key-id]
🔐 Removing IAM policy bindings for mydevchatbotfirebase-admin@my-dev-chatbot-firebase.iam.gserviceaccount.com
✅ Removed mydevchatbotfirebase-admin@my-dev-chatbot-firebase.iam.gserviceaccount.com from role: roles/datastore.user
✅ Removed mydevchatbotfirebase-admin@my-dev-chatbot-firebase.iam.gserviceaccount.com from role: roles/storage.objectAdmin
✅ IAM policy updated - removed all bindings for mydevchatbotfirebase-admin@my-dev-chatbot-firebase.iam.gserviceaccount.com
✅ Service account deleted: mydevchatbotfirebase-admin@my-dev-chatbot-firebase.iam.gserviceaccount.com
✅ Service account deletion completed
*/
