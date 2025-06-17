// DNS Instructions component for clear domain configuration
import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface DnsInstructionsProps {
  domain: string;
  deploymentUrl?: string;
  vercelProjectId?: string;
}

const DnsInstructions: React.FC<DnsInstructionsProps> = ({
  domain,
  deploymentUrl,
  vercelProjectId
}) => {
  const isRootDomain = domain.split('.').length === 2; // e.g., "wizechat.ai" vs "www.wizechat.ai"
  const deploymentTarget = deploymentUrl ? deploymentUrl.replace(/^https?:\/\//, '') : 
    vercelProjectId ? `${vercelProjectId}.vercel.app` : '[Your Vercel URL after deployment]';

  const renderRootDomainInstructions = () => (
    <div className="text-sm bg-gray-50 p-4 rounded border space-y-3">
      <div className="bg-green-50 border border-green-200 rounded p-3">
        <div className="font-semibold text-green-800 mb-2">✅ Recommended for Root Domain ({domain})</div>
        <div className="text-xs font-mono bg-white p-2 rounded border">
          <div className="mb-1"><strong>Record Type:</strong> A</div>
          <div className="mb-1">
            <strong>Name/Host:</strong> <span className="bg-blue-100 px-1 rounded">@</span> 
            <span className="text-gray-500"> (or leave empty - represents your root domain)</span>
          </div>
          <div className="mb-1">
            <strong>Value/Points to:</strong> <span className="bg-green-100 px-1 rounded">76.76.21.21</span>
          </div>
          <div><strong>TTL:</strong> 300 (5 minutes) or Auto</div>
        </div>
        <div className="mt-2 text-xs text-green-700">
          💡 Most DNS providers require A records for root domains (not CNAME)
        </div>
      </div>
      
      {deploymentUrl && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <div className="font-semibold text-blue-800 mb-2">🔧 Alternative (if A record doesn't work)</div>
          <div className="text-xs font-mono bg-white p-2 rounded border">
            <div className="mb-1"><strong>Record Type:</strong> CNAME</div>
            <div className="mb-1">
              <strong>Name/Host:</strong> <span className="bg-blue-100 px-1 rounded">@</span> 
              <span className="text-gray-500"> (or {domain})</span>
            </div>
            <div className="mb-1">
              <strong>Value/Points to:</strong> <span className="bg-green-100 px-1 rounded">{deploymentTarget}</span>
            </div>
            <div><strong>TTL:</strong> 300 (5 minutes) or Auto</div>
          </div>
          <div className="mt-2 text-xs text-blue-700">
            ⚠️ Only use if your DNS provider supports CNAME for root domains
          </div>
        </div>
      )}
    </div>
  );

  const renderSubdomainInstructions = () => {
    const subdomain = domain.split('.')[0]; // "www" or "chat"
    return (
      <div className="text-sm bg-gray-50 p-4 rounded border space-y-3">
        <div className="bg-green-50 border border-green-200 rounded p-3">
          <div className="font-semibold text-green-800 mb-2">✅ Recommended for Subdomain ({domain})</div>
          <div className="text-xs font-mono bg-white p-2 rounded border">
            <div className="mb-1"><strong>Record Type:</strong> CNAME</div>
            <div className="mb-1">
              <strong>Name/Host:</strong> <span className="bg-blue-100 px-1 rounded">{subdomain}</span> 
              <span className="text-gray-500"> (just the subdomain part)</span>
            </div>
            <div className="mb-1">
              <strong>Value/Points to:</strong> <span className="bg-green-100 px-1 rounded">{deploymentTarget}</span>
            </div>
            <div><strong>TTL:</strong> 300 (5 minutes) or Auto</div>
          </div>
          <div className="mt-2 text-xs text-green-700">
            💡 CNAME records work best for subdomains and auto-update if servers change
          </div>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <div className="font-semibold text-blue-800 mb-2">🔧 Alternative (A Record)</div>
          <div className="text-xs font-mono bg-white p-2 rounded border">
            <div className="mb-1"><strong>Record Type:</strong> A</div>
            <div className="mb-1">
              <strong>Name/Host:</strong> <span className="bg-blue-100 px-1 rounded">{subdomain}</span>
            </div>
            <div className="mb-1">
              <strong>Value/Points to:</strong> <span className="bg-green-100 px-1 rounded">76.76.21.21</span>
            </div>
            <div><strong>TTL:</strong> 300 (5 minutes) or Auto</div>
          </div>
        </div>
      </div>
    );
  };

  const renderQuickCopy = () => {
    if (!deploymentUrl) return null;

    const deploymentTargetClean = deploymentUrl.replace(/^https?:\/\//, '');
    
    return (
      <div className="mt-4 p-3 bg-white rounded border">
        <div className="font-medium text-gray-800 mb-2">📋 Quick Copy (for your DNS provider)</div>
        <div className="text-xs font-mono space-y-1">
          {isRootDomain ? (
            <>
              <div className="flex items-center justify-between group bg-green-50 p-2 rounded">
                <span className="text-gray-700">A Record: <strong>@</strong> → <strong>76.76.21.21</strong></span>
                <button 
                  onClick={() => navigator.clipboard.writeText(`@ A 76.76.21.21`)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-700"
                  title="Copy to clipboard"
                >
                  📋
                </button>
              </div>
              <div className="flex items-center justify-between group bg-blue-50 p-2 rounded">
                <span className="text-gray-700">Alt CNAME: <strong>@</strong> → <strong>{deploymentTargetClean}</strong></span>
                <button 
                  onClick={() => navigator.clipboard.writeText(`@ CNAME ${deploymentTargetClean}`)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-700"
                  title="Copy to clipboard"
                >
                  📋
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between group bg-green-50 p-2 rounded">
                <span className="text-gray-700">CNAME: <strong>{domain.split('.')[0]}</strong> → <strong>{deploymentTargetClean}</strong></span>
                <button 
                  onClick={() => navigator.clipboard.writeText(`${domain.split('.')[0]} CNAME ${deploymentTargetClean}`)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-700"
                  title="Copy to clipboard"
                >
                  📋
                </button>
              </div>
              <div className="flex items-center justify-between group bg-blue-50 p-2 rounded">
                <span className="text-gray-700">Alt A Record: <strong>{domain.split('.')[0]}</strong> → <strong>76.76.21.21</strong></span>
                <button 
                  onClick={() => navigator.clipboard.writeText(`${domain.split('.')[0]} A 76.76.21.21`)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 hover:text-blue-700"
                  title="Copy to clipboard"
                >
                  📋
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertDescription>
        <p className="font-medium mb-2">DNS Configuration Required</p>
        <p className="text-sm mb-3">Configure your DNS settings with your domain provider (GoDaddy, Namecheap, Cloudflare, etc.):</p>
        
        {isRootDomain ? renderRootDomainInstructions() : renderSubdomainInstructions()}
        
        {renderQuickCopy()}
        
        <div className="mt-4 text-sm space-y-2">
          <div className="font-medium text-gray-800">📝 Step-by-Step:</div>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 ml-2">
            <li>Login to your domain provider (GoDaddy, Namecheap, Cloudflare, etc.)</li>
            <li>Go to DNS Management or DNS Zone Editor</li>
            <li>Add the recommended DNS record above</li>
            <li>Save changes and wait 5-30 minutes for DNS propagation</li>
            <li>Come back and test your domain</li>
          </ol>
        </div>
        
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
          <strong className="text-yellow-800">⏰ DNS Propagation:</strong> 
          <span className="text-yellow-700"> Changes can take 5-30 minutes to take effect worldwide. Some providers are faster than others.</span>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default DnsInstructions;