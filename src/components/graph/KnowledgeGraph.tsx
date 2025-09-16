'use client';

import { useState, useEffect } from 'react';
import { InteractiveNvlWrapper } from '@neo4j-nvl/react';
import { Loader2, AlertCircle, Maximize2, Minimize2, ExternalLink, Database, Play, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

interface NVLNode {
  id: string;
  size?: number;
  color?: string;
  caption?: string;
  labels?: string[];
  properties?: Record<string, any>;
}

interface NVLRelationship {
  id: string;
  from: string;
  to: string;
  caption?: string;
  type?: string;
  properties?: Record<string, any>;
}

interface Props {
  chatbotId: string;
}

export function KnowledgeGraph({ chatbotId }: Props) {
  const [graphData, setGraphData] = useState<{ nodes: NVLNode[]; rels: NVLRelationship[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stats, setStats] = useState<{ nodeCount: number; relationshipCount: number } | null>(null);
  const [neo4jConfig, setNeo4jConfig] = useState<any>(null);
  const [cypherQuery, setCypherQuery] = useState('MATCH (n) RETURN n LIMIT 25');
  const [showQueryPanel, setShowQueryPanel] = useState(false);

  useEffect(() => {
    fetchGraphData();
    fetchNeo4jConfig();
  }, [chatbotId]); // eslint-disable-line react-hooks/exhaustive-deps

  // FREE TIER: Fetch Neo4j config for browser.neo4j.io redirect
  // ENTERPRISE TODO: This would include user-specific database and credentials
  const fetchNeo4jConfig = async () => {
    try {
      const response = await fetch(`/api/chatbot/${chatbotId}/neo4j-config`);
      if (response.ok) {
        const result = await response.json();
        setNeo4jConfig(result.config);
      }
    } catch (err) {
      console.error('Failed to fetch Neo4j config:', err);
    }
  };

  const fetchGraphData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(`🔍 Fetching graph data for chatbot: ${chatbotId}`);

      const response = await fetch(`/api/chatbot/${chatbotId}/graph-data`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch graph data');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'API returned unsuccessful response');
      }

      console.log(`✅ Retrieved graph data:`, result.stats);

      // Transform Neo4j data to NVL format
      const nvlNodes: NVLNode[] = result.data.nodes.map((node: GraphNode) => ({
        id: node.id,
        caption: getNodeCaption(node),
        size: 20,
        color: getNodeColor(node.labels),
        labels: node.labels,
        properties: node.properties
      }));

      const nvlRels: NVLRelationship[] = result.data.relationships.map((rel: GraphRelationship) => ({
        id: rel.id,
        from: rel.startNodeId,
        to: rel.endNodeId,
        caption: rel.type,
        type: rel.type,
        properties: rel.properties
      }));

      setGraphData({ nodes: nvlNodes, rels: nvlRels });
      setStats(result.stats);

    } catch (err) {
      console.error('❌ Error fetching graph data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getNodeCaption = (node: GraphNode): string => {
    // Try to find a good caption from properties
    const properties = node.properties || {};

    // Common property names for captions
    const captionProps = ['name', 'title', 'text', 'content', 'id'];

    for (const prop of captionProps) {
      if (properties[prop]) {
        const value = properties[prop];
        if (typeof value === 'string') {
          return value.length > 30 ? value.substring(0, 30) + '...' : value;
        }
      }
    }

    // Fallback to label or node ID
    return node.labels?.[0] || `Node ${node.id}`;
  };

  const getNodeColor = (labels: string[]): string => {
    // Color coding based on node labels
    const colorMap: Record<string, string> = {
      'Document': '#3b82f6',      // blue
      'Chunk': '#10b981',         // green
      'Entity': '#f59e0b',        // amber
      'Topic': '#ef4444',         // red
      'Concept': '#8b5cf6',       // purple
      'User': '#06b6d4',          // cyan
      'Query': '#84cc16',         // lime
    };

    for (const label of labels || []) {
      if (colorMap[label]) {
        return colorMap[label];
      }
    }

    return '#6b7280'; // gray fallback
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // FREE TIER: Open in Neo4j Browser with credentials pre-filled
  // ENTERPRISE TODO: Open with user-specific database and permissions
  const openInNeo4jBrowser = () => {
    if (!neo4jConfig) {
      alert('Neo4j configuration not available');
      return;
    }

    // Construct URL for browser.neo4j.io with pre-filled credentials
    // Format: dbms=neo4j+s://username@hostname:port&db=database
    const connectionUrl = neo4jConfig.uri.replace('neo4j+s://', `neo4j+s://${neo4jConfig.username}@`);

    const params = new URLSearchParams({
      dbms: connectionUrl,
      db: neo4jConfig.database,
      // Note: Password cannot be pre-filled via URL for security reasons
      // User will need to enter password manually: neo4jConfig.password
      // FREE TIER: Opens entire database (no user isolation)
      // ENTERPRISE TODO: Add user-specific database parameter
      // db: neo4jConfig.userDatabase || neo4jConfig.database
    });

    const browserUrl = `https://browser.neo4j.io/?${params.toString()}`;

    console.log('🔗 Opening Neo4j Browser with config:', {
      originalUri: neo4jConfig.uri,
      connectionUrl: connectionUrl,
      database: neo4jConfig.database,
      username: neo4jConfig.username,
      instanceName: neo4jConfig.instanceName,
      finalUrl: browserUrl
    });

    // Open in new tab
    window.open(browserUrl, '_blank', 'noopener,noreferrer');
  };

  const executeQuery = () => {
    // TODO: Implement query execution within the component
    // For now, this just updates the graph with current data
    fetchGraphData();
  };

  const toggleQueryPanel = () => {
    setShowQueryPanel(!showQueryPanel);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600 dark:text-gray-400">Loading knowledge graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-4 text-red-600" />
          <p className="text-gray-900 dark:text-gray-100 font-medium mb-2">Failed to load graph</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{error}</p>
          <button
            onClick={fetchGraphData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-center">
          <div className="h-8 w-8 mx-auto mb-4 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
          <p className="text-gray-900 dark:text-gray-100 font-medium mb-2">No graph data</p>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            This chatbot doesn't have any graph data yet. Upload some documents to build the knowledge graph.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900' : 'relative'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Knowledge Graph
          </h3>
          {stats && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {stats.nodeCount} nodes, {stats.relationshipCount} relationships
            </p>
          )}
          {/* FREE TIER WARNING */}
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            ⚠️ Free Tier: All users see the same data
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Query Panel Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleQueryPanel}
            className="flex items-center gap-2"
            title="Toggle query panel"
          >
            <Search className="h-4 w-4" />
            Query
          </Button>

          {/* Open in Neo4j Browser */}
          <Button
            variant="outline"
            size="sm"
            onClick={openInNeo4jBrowser}
            disabled={!neo4jConfig}
            className="flex items-center gap-2 bg-[#4581C3] hover:bg-[#3D73B1] text-white border-[#4581C3]"
            title={neo4jConfig ?
              `Open Neo4j Browser with pre-filled credentials for ${neo4jConfig.instanceName}` :
              "Neo4j configuration loading..."
            }
          >
            <ExternalLink className="h-4 w-4" />
            Neo4j Browser
          </Button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Query Panel */}
      {showQueryPanel && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">Cypher Query</h4>
            <span className="text-xs text-gray-500 dark:text-gray-400">(Neo4j Browser-like interface)</span>
          </div>
          <div className="flex gap-2">
            <Input
              value={cypherQuery}
              onChange={(e) => setCypherQuery(e.target.value)}
              placeholder="Enter Cypher query..."
              className="font-mono text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  executeQuery();
                }
              }}
            />
            <Button
              onClick={executeQuery}
              size="sm"
              className="flex items-center gap-1 bg-[#4581C3] hover:bg-[#3D73B1]"
            >
              <Play className="h-3 w-3" />
              Run
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Press Ctrl+Enter to execute • Currently refreshes the graph view
          </p>
          {/* ENTERPRISE TODO: Add query results panel */}
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            💡 Enterprise: Full query execution with results, history, and user-specific permissions
          </div>
        </div>
      )}

      {/* Graph Visualization */}
      <div className={`${isFullscreen ? 'h-[calc(100vh-140px)]' : showQueryPanel ? 'h-80' : 'h-96'} bg-white dark:bg-gray-900`}>
        <InteractiveNvlWrapper
          nodes={graphData.nodes}
          rels={graphData.rels}
          nvlOptions={{
            allowDynamicMinZoom: true,
            maxZoom: 3,
            minZoom: 0.1,
            initialZoom: 1,
            disableWebGL: false,
            instanceId: `knowledge-graph-${chatbotId}`
          }}
          mouseEventCallbacks={{
            onNodeClick: (node) => {
              console.log('Node clicked:', node);
            },
            onRelationshipClick: (rel) => {
              console.log('Relationship clicked:', rel);
            },
            onCanvasClick: true,
            onZoom: true,
            onPan: true
          }}
        />
      </div>

      {/* Neo4j Browser-like Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex flex-wrap justify-between items-center gap-4">
          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-gray-700 dark:text-gray-300">Documents</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-700 dark:text-gray-300">Chunks</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <span className="text-gray-700 dark:text-gray-300">Entities</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <span className="text-gray-700 dark:text-gray-300">Concepts</span>
            </div>
          </div>

          {/* Connection Status */}
          <div className="flex items-center gap-4 text-xs">
            {neo4jConfig && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span>Connected: {neo4jConfig.instanceName}</span>
                </div>
                <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
                  <span>DB: {neo4jConfig.database}</span>
                  <span>User: {neo4jConfig.username}</span>
                  <span>{neo4jConfig.uri.split('://')[0].toUpperCase()}</span>
                </div>
              </div>
            )}
            <div className="text-gray-500 dark:text-gray-400">
              Free Tier • Enterprise needed for user isolation
            </div>
          </div>
        </div>

        {/* Password Notice & Enterprise Upgrade */}
        <div className="mt-3 space-y-2">
          {neo4jConfig && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <strong>🔑 Password Required:</strong> After clicking "Neo4j Browser", enter password: <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">{neo4jConfig.password}</code>
              </div>
            </div>
          )}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <strong>🚀 Enterprise Features:</strong> User-specific databases, RBAC, query history, advanced security controls
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}