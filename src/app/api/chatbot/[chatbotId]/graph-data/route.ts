import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import neo4j from 'neo4j-driver';

/**
 * Neo4j Graph Data API
 * ===================
 *
 * Fetches graph data from the chatbot's Neo4j AuraDB instance
 * for visualization in the Knowledge Graph tab.
 */

interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

interface GraphRelationship {
  id: string;
  type: string;
  startNodeId: string;
  endNodeId: string;
  properties: Record<string, any>;
}

interface GraphData {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

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

    console.log(`🔍 Fetching graph data for chatbot: ${chatbotId}`);

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
    if (!neo4jConfig.uri || !neo4jConfig.username || !neo4jConfig.password) {
      return NextResponse.json(
        { error: 'Incomplete Neo4j configuration' },
        { status: 500 }
      );
    }

    console.log(`🔗 Connecting to Neo4j: ${neo4jConfig.uri}`);

    // Create Neo4j driver
    const driver = neo4j.driver(
      neo4jConfig.uri,
      neo4j.auth.basic(neo4jConfig.username, neo4jConfig.password)
    );

    let session;
    try {
      session = driver.session();

      // Test connection first
      await session.run('RETURN 1');
      console.log('✅ Neo4j connection successful');

      // Query to get a sample of nodes and relationships
      // Limit to prevent overwhelming the UI with too much data
      const query = `
        MATCH (n)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, r, m
        LIMIT 100
      `;

      console.log('📊 Executing graph query...');
      const result = await session.run(query);

      const nodes = new Map<string, GraphNode>();
      const relationships: GraphRelationship[] = [];

      // Process query results
      result.records.forEach((record) => {
        // Process start node
        const nodeN = record.get('n');
        if (nodeN) {
          const nodeId = nodeN.identity.toString();
          if (!nodes.has(nodeId)) {
            nodes.set(nodeId, {
              id: nodeId,
              labels: nodeN.labels,
              properties: nodeN.properties
            });
          }
        }

        // Process end node
        const nodeM = record.get('m');
        if (nodeM) {
          const nodeId = nodeM.identity.toString();
          if (!nodes.has(nodeId)) {
            nodes.set(nodeId, {
              id: nodeId,
              labels: nodeM.labels,
              properties: nodeM.properties
            });
          }
        }

        // Process relationship
        const rel = record.get('r');
        if (rel) {
          relationships.push({
            id: rel.identity.toString(),
            type: rel.type,
            startNodeId: rel.start.toString(),
            endNodeId: rel.end.toString(),
            properties: rel.properties
          });
        }
      });

      const graphData: GraphData = {
        nodes: Array.from(nodes.values()),
        relationships
      };

      console.log(`✅ Retrieved ${graphData.nodes.length} nodes and ${graphData.relationships.length} relationships`);

      return NextResponse.json({
        success: true,
        data: graphData,
        stats: {
          nodeCount: graphData.nodes.length,
          relationshipCount: graphData.relationships.length
        }
      });

    } catch (neo4jError) {
      console.error('❌ Neo4j query error:', neo4jError);
      return NextResponse.json(
        {
          error: 'Failed to query Neo4j database',
          details: neo4jError instanceof Error ? neo4jError.message : 'Unknown error'
        },
        { status: 500 }
      );
    } finally {
      if (session) {
        await session.close();
      }
      await driver.close();
    }

  } catch (error) {
    console.error('❌ Graph data API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}