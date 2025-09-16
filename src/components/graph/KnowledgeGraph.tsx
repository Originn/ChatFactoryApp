'use client';

import { useState, useEffect } from 'react';
import { InteractiveNvlWrapper } from '@neo4j-nvl/react';
import { Loader2, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';

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

  useEffect(() => {
    fetchGraphData();
  }, [chatbotId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Knowledge Graph
          </h3>
          {stats && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {stats.nodeCount} nodes, {stats.relationshipCount} relationships
            </p>
          )}
        </div>
        <button
          onClick={toggleFullscreen}
          className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>
      </div>

      {/* Graph Visualization */}
      <div className={`${isFullscreen ? 'h-[calc(100vh-80px)]' : 'h-96'} bg-white dark:bg-gray-900`}>
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
            onNodeHover: true,
            onRelationshipClick: (rel) => {
              console.log('Relationship clicked:', rel);
            },
            onCanvasClick: true,
            onZoom: true,
            onPan: true
          }}
        />
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
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
      </div>
    </div>
  );
}