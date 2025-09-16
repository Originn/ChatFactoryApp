import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * Neo4j Configuration API (Free Tier Implementation)
 * ==================================================
 *
 * Returns Neo4j connection configuration for opening in browser.neo4j.io
 *
 * FREE TIER LIMITATION:
 * - Currently provides access to the entire database (no user isolation)
 * - All users see the same data within a chatbot's database
 *
 * ENTERPRISE UPGRADE PATH:
 * - TODO: Implement user-specific database access using Neo4j Enterprise multi-database feature
 * - TODO: Add role-based access control (RBAC) for fine-grained permissions
 * - TODO: Create user-specific database aliases: CREATE ALIAS user123_graph FOR DATABASE chatbot_user_123
 * - TODO: Implement per-user credentials with restricted database access
 *
 * For Enterprise implementation, see:
 * - https://neo4j.com/docs/operations-manual/current/tutorial/access-control/
 * - https://neo4j.com/developer/multi-tenancy-worked-example/
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { chatbotId: string } }
): Promise<NextResponse> {
  try {
    const { chatbotId } = params;

    if (!chatbotId) {
      return NextResponse.json(
        { error: 'Missing chatbot ID' },
        { status: 400 }
      );
    }

    console.log(`🔍 Fetching Neo4j config for chatbot: ${chatbotId}`);

    // Get chatbot document with Neo4j credentials
    const chatbotDoc = await adminDb.collection('chatbots').doc(chatbotId).get();

    if (!chatbotDoc.exists) {
      return NextResponse.json(
        { error: 'Chatbot not found' },
        { status: 404 }
      );
    }

    const chatbotData = chatbotDoc.data();

    // Check if chatbot has Neo4j instance
    if (!chatbotData?.neo4j) {
      return NextResponse.json(
        { error: 'No Neo4j instance found for this chatbot' },
        { status: 404 }
      );
    }

    const neo4jConfig = chatbotData.neo4j;

    // Validate Neo4j configuration
    if (!neo4jConfig.uri || !neo4jConfig.username) {
      return NextResponse.json(
        { error: 'Incomplete Neo4j configuration' },
        { status: 500 }
      );
    }

    // FREE TIER: Return connection parameters for browser.neo4j.io
    // NOTE: This gives access to the entire chatbot database
    // ENTERPRISE TODO: Return user-specific database alias and credentials
    return NextResponse.json({
      success: true,
      config: {
        uri: neo4jConfig.uri,
        username: neo4jConfig.username,
        database: neo4jConfig.database || 'neo4j',
        instanceName: neo4jConfig.instanceName || `chatbot-${chatbotId}`,
        // ENTERPRISE TODO: Add user-specific fields
        // userDatabase: `chatbot_${chatbotId}_user_${userId}`,
        // userRole: `${chatbotId}_user_role`,
        // accessLevel: 'read-only' | 'read-write'
      },
      limitations: {
        freeTier: true,
        userIsolation: false,
        message: "Free tier: All users see the same database. Upgrade to Enterprise for user isolation."
      }
    });

  } catch (error) {
    console.error('❌ Neo4j config API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}