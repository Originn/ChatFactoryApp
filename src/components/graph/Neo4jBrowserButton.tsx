'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, Database, Copy, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  chatbotId: string;
}

export function Neo4jBrowserButton({ chatbotId }: Props) {
  const [neo4jConfig, setNeo4jConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    fetchNeo4jConfig();
  }, [chatbotId]);

  // FREE TIER: Fetch Neo4j config for browser.neo4j.io redirect
  // ENTERPRISE TODO: This would include user-specific database and credentials
  const fetchNeo4jConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/chatbot/${chatbotId}/neo4j-config`);
      if (response.ok) {
        const result = await response.json();
        setNeo4jConfig(result.config);
      } else {
        setError('Neo4j instance not found');
      }
    } catch (err) {
      console.error('Failed to fetch Neo4j config:', err);
      setError('Failed to load Neo4j configuration');
    } finally {
      setLoading(false);
    }
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

  const copyPassword = async () => {
    if (!neo4jConfig?.password) return;

    try {
      await navigator.clipboard.writeText(neo4jConfig.password);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy password:', err);
    }
  };

  const getMaskedPassword = (password: string) => {
    if (!password) return '';
    // Show first 4 characters, mask the rest
    return password.substring(0, 4) + '*'.repeat(password.length - 4);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <Database className="h-5 w-5 animate-pulse" />
          <span>Loading Neo4j configuration...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="text-center text-gray-600 dark:text-gray-400">
            <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium">No Knowledge Graph Available</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Neo4j Browser Access Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="h-6 w-6 text-[#4581C3]" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Knowledge Graph Access
          </h3>
        </div>

        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Access your complete knowledge graph using the official Neo4j Browser interface.
            View nodes, relationships, and execute Cypher queries directly.
          </p>

          {/* Connection Info */}
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              Connection Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Instance:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">{neo4jConfig.instanceName}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Database:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">{neo4jConfig.database}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Username:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">{neo4jConfig.username}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Protocol:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">{neo4jConfig.uri.split('://')[0].toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Password Section */}
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="text-sm text-amber-800 dark:text-amber-200 space-y-2">
              <div>
                <strong>🔑 Password Required:</strong> After clicking "Open Neo4j Browser", enter the password below:
              </div>
              <div className="flex items-center gap-2 bg-amber-100 dark:bg-amber-800 p-2 rounded">
                <code className="flex-1 font-mono text-sm">
                  {showPassword ? neo4jConfig.password : getMaskedPassword(neo4jConfig.password)}
                </code>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 hover:bg-amber-200 dark:hover:bg-amber-700 rounded transition-colors"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
                <button
                  onClick={copyPassword}
                  className="p-1 hover:bg-amber-200 dark:hover:bg-amber-700 rounded transition-colors"
                  title="Copy password"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
              {copySuccess && (
                <div className="text-xs text-green-700 dark:text-green-300">
                  ✓ Password copied to clipboard!
                </div>
              )}
            </div>
          </div>

          {/* Open Button */}
          <Button
            onClick={openInNeo4jBrowser}
            className="w-full bg-[#4581C3] hover:bg-[#3D73B1] text-white flex items-center gap-2"
            size="lg"
          >
            <ExternalLink className="h-5 w-5" />
            Open Neo4j Browser
          </Button>

          {/* Free Tier Notice */}
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