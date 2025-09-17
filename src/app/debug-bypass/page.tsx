'use client';

import { useEffect, useState } from 'react';

export default function DebugBypassPage() {
  const [envStatus, setEnvStatus] = useState<any>(null);
  const [bypassStatus, setBypassStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Check environment variables
        const envResponse = await fetch('/api/debug-env');
        const envData = await envResponse.json();
        setEnvStatus(envData);

        // Check bypass status
        const bypassResponse = await fetch('/api/bypass-check');
        const bypassData = await bypassResponse.json();
        setBypassStatus(bypassData);

      } catch (error) {
        console.error('Debug error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkStatus();
  }, []);

  if (loading) {
    return <div className="p-8">Loading debug info...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Bypass Debug Information</h1>

      {/* Environment Variables */}
      <div className="mb-8 bg-gray-100 p-4 rounded">
        <h2 className="text-lg font-semibold mb-4">Environment Variables</h2>
        <pre className="bg-white p-4 rounded text-sm overflow-auto">
          {JSON.stringify(envStatus, null, 2)}
        </pre>
      </div>

      {/* Bypass Status */}
      <div className="mb-8 bg-gray-100 p-4 rounded">
        <h2 className="text-lg font-semibold mb-4">Bypass Status</h2>
        <pre className="bg-white p-4 rounded text-sm overflow-auto">
          {JSON.stringify(bypassStatus, null, 2)}
        </pre>
      </div>

      {/* Instructions */}
      <div className="bg-blue-100 p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Troubleshooting Steps</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>Ensure development server was restarted after changing .env.local</li>
          <li>Check that environment variables are properly loaded</li>
          <li>Verify IP detection is working correctly</li>
          <li>Test bypass API functionality</li>
        </ol>
      </div>
    </div>
  );
}