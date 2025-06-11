'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, Loader2, Eye, EyeOff, Copy, RefreshCw } from 'lucide-react';

interface FirebaseDebugData {
  success: boolean;
  status: string;
  firebaseConfig: any;
  analysis: any;
  recommendations: string[];
  timestamp: string;
  error?: string;
}

export default function FirebaseDebugPage() {
  const [debugData, setDebugData] = useState<FirebaseDebugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFullKey, setShowFullKey] = useState(false);
  const [fullApiKey, setFullApiKey] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchDebugData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug-firebase');
      const data = await response.json();
      setDebugData(data);
    } catch (error) {
      console.error('Failed to fetch debug data:', error);
      setDebugData({
        success: false,
        status: 'ERROR',
        firebaseConfig: {},
        analysis: {},
        recommendations: ['Failed to fetch debug information'],
        timestamp: new Date().toISOString(),
        error: 'Failed to fetch debug information'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchFullApiKey = async () => {
    try {
      const response = await fetch('/api/debug-firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          showFullKey: true, 
          secret: 'debug-firebase-2024' 
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setFullApiKey(data.fullApiKey || '');
        setShowFullKey(true);
      }
    } catch (error) {
      console.error('Failed to fetch full API key:', error);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  useEffect(() => {
    fetchDebugData();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'LIKELY_VALID':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'FAKE_KEY_DETECTED':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'MISSING':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'SUSPICIOUS':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'LIKELY_VALID':
        return 'bg-green-100 text-green-800';
      case 'FAKE_KEY_DETECTED':
        return 'bg-red-100 text-red-800';
      case 'MISSING':
        return 'bg-red-100 text-red-800';
      case 'SUSPICIOUS':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-2 text-gray-600">Loading Firebase debug info...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Firebase Configuration Debug</h1>
          <p className="mt-2 text-gray-600">
            Check if your Firebase API key is properly configured
          </p>
          <div className="mt-4 flex gap-4">
            <Button onClick={fetchDebugData} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {debugData?.status === 'LIKELY_VALID' && (
              <Button onClick={fetchFullApiKey} variant="outline">
                <Eye className="mr-2 h-4 w-4" />
                Show Full API Key
              </Button>
            )}
          </div>
        </div>

        {debugData && (
          <div className="space-y-6">
            {/* Status Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {getStatusIcon(debugData.status)}
                  Status Overview
                </CardTitle>
                <CardDescription>
                  Last checked: {new Date(debugData.timestamp).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Badge className={getStatusColor(debugData.status)}>
                    {debugData.status.replace('_', ' ')}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    {debugData.success ? 'Configuration loaded' : 'Error occurred'}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Firebase Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Firebase Configuration</CardTitle>
                <CardDescription>
                  Current environment variables and configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(debugData.firebaseConfig).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="font-medium text-sm">{key}:</span>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {value || 'MISSING'}
                        </code>
                        {value && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(value as string)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* API Key Analysis */}
            {debugData.analysis && (
              <Card>
                <CardHeader>
                  <CardTitle>API Key Analysis</CardTitle>
                  <CardDescription>
                    Detailed analysis of the Firebase API key
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Has API Key:</span>
                        <Badge variant={debugData.analysis.hasApiKey ? "default" : "destructive"}>
                          {debugData.analysis.hasApiKey ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Starts with 'AIza':</span>
                        <Badge variant={debugData.analysis.startsWithAIza ? "default" : "destructive"}>
                          {debugData.analysis.startsWithAIza ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Length:</span>
                        <span className="text-sm">{debugData.analysis.length} chars</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Likely Valid:</span>
                        <Badge variant={debugData.analysis.isLikelyValid ? "default" : "destructive"}>
                          {debugData.analysis.isLikelyValid ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Likely Fake:</span>
                        <Badge variant={debugData.analysis.isLikelyFake ? "destructive" : "default"}>
                          {debugData.analysis.isLikelyFake ? 'Yes' : 'No'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Format:</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {debugData.analysis.prefix}...{debugData.analysis.suffix}
                        </code>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Full API Key (if requested) */}
            {showFullKey && fullApiKey && (
              <Card className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-yellow-800">
                    <Eye className="h-5 w-5" />
                    Full API Key (Sensitive!)
                  </CardTitle>
                  <CardDescription className="text-yellow-700">
                    Keep this secure! Don't share or commit to version control.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-white px-3 py-2 rounded border">
                      {fullApiKey}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(fullApiKey)}
                    >
                      {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowFullKey(false)}
                    >
                      <EyeOff className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>
                  Actions to fix any issues found
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {debugData.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-sm mt-0.5">•</span>
                      <span className="text-sm">{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Error Details */}
            {debugData.error && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader>
                  <CardTitle className="text-red-800">Error Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <code className="text-sm text-red-700">{debugData.error}</code>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
