import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExternalLink, CheckCircle, AlertTriangle, XCircle, RefreshCw } from "lucide-react";

interface CustomDomainStatusProps {
  chatbotId: string;
  customDomain?: string;
  vercelProjectId?: string;
  firebaseProjectId?: string;
}

interface DomainInfo {
  domain: string;
  verified: boolean;
  configured: boolean;
}

interface FirebaseAuthDomains {
  success: boolean;
  firebaseProjectId: string;
  authorizedDomains: string[];
  customDomain: string | null;
  customDomainAuthorized: boolean;
  consoleUrl: string;
}

const CustomDomainStatus: React.FC<CustomDomainStatusProps> = ({
  chatbotId,
  customDomain,
  vercelProjectId,
  firebaseProjectId
}) => {
  const [domainInfo, setDomainInfo] = useState<DomainInfo | null>(null);
  const [firebaseAuth, setFirebaseAuth] = useState<FirebaseAuthDomains | null>(null);
  const [loading, setLoading] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDomainStatus = async () => {
    if (!customDomain) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Check Vercel domain status
      const vercelResponse = await fetch(`/api/domains?chatbotId=${chatbotId}&domain=${customDomain}`);
      const vercelData = await vercelResponse.json();
      
      if (vercelData.success) {
        setDomainInfo({
          domain: vercelData.domain,
          verified: vercelData.verified,
          configured: vercelData.configured
        });
      }

      // Check Firebase authorized domains
      const firebaseResponse = await fetch(`/api/domains/authorize?chatbotId=${chatbotId}`);
      const firebaseData = await firebaseResponse.json();
      
      if (firebaseData.success) {
        setFirebaseAuth(firebaseData);
      }
      
    } catch (err: any) {
      setError(err.message || 'Failed to fetch domain status');
    } finally {
      setLoading(false);
    }
  };

  const authorizeFirebaseDomain = async () => {
    if (!customDomain) return;
    
    setAuthorizing(true);
    try {
      const response = await fetch('/api/domains/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatbotId,
          customDomain
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Refresh the status
        await fetchDomainStatus();
      } else {
        setError(data.error || 'Failed to authorize domain');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to authorize domain');
    } finally {
      setAuthorizing(false);
    }
  };

  useEffect(() => {
    fetchDomainStatus();
  }, [chatbotId, customDomain]);

  if (!customDomain) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Custom Domain
            <Badge variant="secondary">Not Configured</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            No custom domain configured for this chatbot.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isCustomDomainInFirebase = firebaseAuth?.authorizedDomains.includes(customDomain);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Custom Domain Status</span>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDomainStatus}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Domain Information */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Domain:</span>
            <code className="text-xs bg-gray-100 px-2 py-1 rounded">{customDomain}</code>
          </div>
          
          {domainInfo && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Vercel Configuration:</span>
                <Badge variant={domainInfo.configured ? "default" : "secondary"}>
                  {domainInfo.configured ? (
                    <><CheckCircle className="h-3 w-3 mr-1" /> Configured</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" /> Not Configured</>
                  )}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">DNS Verification:</span>
                <Badge variant={domainInfo.verified ? "default" : "destructive"}>
                  {domainInfo.verified ? (
                    <><CheckCircle className="h-3 w-3 mr-1" /> Verified</>
                  ) : (
                    <><AlertTriangle className="h-3 w-3 mr-1" /> Pending</>
                  )}
                </Badge>
              </div>
            </>
          )}
        </div>

        {/* Firebase Authorization Status */}
        {firebaseAuth && (
          <div className="space-y-2 pt-4 border-t">
            <h4 className="text-sm font-semibold">Firebase Authentication</h4>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Authorization Status:</span>
              <Badge variant={isCustomDomainInFirebase ? "default" : "destructive"}>
                {isCustomDomainInFirebase ? (
                  <><CheckCircle className="h-3 w-3 mr-1" /> Authorized</>
                ) : (
                  <><XCircle className="h-3 w-3 mr-1" /> Not Authorized</>
                )}
              </Badge>
            </div>

            {!isCustomDomainInFirebase && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <p>Your custom domain is not authorized in Firebase Authentication. Users won't be able to sign in using this domain.</p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={authorizeFirebaseDomain}
                      disabled={authorizing}
                    >
                      {authorizing ? 'Authorizing...' : 'Authorize Domain'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a 
                        href={firebaseAuth.consoleUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1"
                      >
                        Manual Setup <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="text-xs text-gray-500 space-y-1">
              <div>Firebase Project: <code>{firebaseAuth.firebaseProjectId}</code></div>
              <div>Authorized Domains: {firebaseAuth.authorizedDomains.length}</div>
            </div>
          </div>
        )}

        {/* Instructions for DNS setup */}
        {domainInfo && !domainInfo.verified && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-2">DNS Configuration Required</p>
              <p className="text-sm mb-2">To use <strong>{customDomain}</strong>, configure your DNS with these exact settings:</p>
              <div className="text-xs bg-gray-50 p-3 rounded font-mono space-y-2 border">
                <div>
                  <strong className="text-gray-700">Option 1 - CNAME Record (Recommended):</strong>
                  <div className="ml-2 mt-1 p-2 bg-white rounded border">
                    <div className="text-blue-600">
                      <span className="font-semibold">Host/Name:</span> {customDomain}
                    </div>
                    <div className="text-green-600">
                      <span className="font-semibold">Points to:</span> {vercelProjectId}.vercel.app
                    </div>
                  </div>
                </div>
                
                <div className="text-center text-gray-400 font-normal">OR</div>
                
                <div>
                  <strong className="text-gray-700">Option 2 - A Record:</strong>
                  <div className="ml-2 mt-1 p-2 bg-white rounded border">
                    <div className="text-blue-600">
                      <span className="font-semibold">Host/Name:</span> {customDomain}
                    </div>
                    <div className="text-green-600">
                      <span className="font-semibold">Points to:</span> 76.76.21.21
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-2 text-sm space-y-1">
                <div className="font-medium text-gray-700">📋 Copy-paste ready:</div>
                <div className="bg-white p-2 rounded border text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between group">
                    <span>CNAME: <span className="text-blue-600">{customDomain}</span> → <span className="text-green-600">{vercelProjectId}.vercel.app</span></span>
                    <button 
                      onClick={() => navigator.clipboard.writeText(`${customDomain} CNAME ${vercelProjectId}.vercel.app`)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 text-xs"
                      title="Copy"
                    >
                      📋
                    </button>
                  </div>
                  <div className="flex items-center justify-between group">
                    <span>A: <span className="text-blue-600">{customDomain}</span> → <span className="text-green-600">76.76.21.21</span></span>
                    <button 
                      onClick={() => navigator.clipboard.writeText(`${customDomain} A 76.76.21.21`)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 text-xs"
                      title="Copy"
                    >
                      📋
                    </button>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default CustomDomainStatus;
