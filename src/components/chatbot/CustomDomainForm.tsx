// DEBUG: Custom domain form component for setting chatbot custom domains
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle, 
  AlertTriangle, 
  Globe, 
  ExternalLink,
  AlertCircle,
  Loader2,
  Rocket
} from "lucide-react";
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import DnsInstructions from './DnsInstructions';

interface CustomDomainFormProps {
  chatbotId: string;
  currentDomain?: string;
  vercelProjectId?: string;
  deploymentUrl?: string; // Add deploymentUrl prop
  onDomainUpdated?: (domain: string) => void;
}

const CustomDomainForm: React.FC<CustomDomainFormProps> = ({
  chatbotId,
  currentDomain = '',
  vercelProjectId,
  deploymentUrl,
  onDomainUpdated
}) => {
  const [domain, setDomain] = useState(currentDomain);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<string>('');

  // Domain validation regex
  const validateDomain = (domain: string): boolean => {
    if (!domain.trim()) return false;
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain.trim()) && domain.length <= 253;
  };

  // Add domain to existing Vercel project
  const addDomainToProject = async (domainToUse: string) => {
    setIsDeploying(true);
    setDeploymentStatus('Adding domain to your Vercel project...');
    
    try {
      const response = await fetch('/api/add-domain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chatbotId: chatbotId,
          domain: domainToUse,
          projectName: vercelProjectId || 'testbot' // Use existing project name
        })
      });

      if (!response.ok) {
        throw new Error('Failed to add domain to project');
      }

      const data = await response.json();
      
      if (data.success) {
        setDeploymentStatus('Domain added successfully!');
        setSuccess(`🎉 Custom domain "${domainToUse}" has been added to your Vercel project! Your chatbot should be accessible at https://${domainToUse} within 5-10 minutes.`);
      } else {
        throw new Error(data.error || 'Failed to add domain');
      }
    } catch (err: any) {
      console.error('Domain addition error:', err);
      setDeploymentStatus('');
      setError(`Failed to add domain: ${err.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  // Handle initial validation and show confirmation
  const handleSubmit = async () => {
    const trimmedDomain = domain.trim().toLowerCase();
    
    // Remove protocol if user included it
    const cleanDomain = trimmedDomain
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');

    setError(null);
    setSuccess(null);

    // Validate domain format
    if (!validateDomain(cleanDomain)) {
      setError('Please enter a valid domain name (e.g., chat.yourcompany.com)');
      return;
    }

    // Check for common mistakes
    if (cleanDomain.includes('vercel.app')) {
      setError('Please enter your own custom domain, not a Vercel domain');
      return;
    }

    if (cleanDomain.includes('localhost') || cleanDomain.includes('127.0.0.1')) {
      setError('Please enter a public domain, not localhost');
      return;
    }

    // Store the clean domain and show confirmation
    setDomain(cleanDomain);
    setShowConfirmation(true);
  };

  // Actually save domain and deploy
  const confirmAndSave = async () => {
    const cleanDomain = domain.trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');

    setShowConfirmation(false);
    setIsLoading(true);
    setDeploymentStatus('Saving custom domain...');

    try {
      // Update Firestore with the custom domain
      const chatbotRef = doc(db, 'chatbots', chatbotId);
      await updateDoc(chatbotRef, {
        domain: cleanDomain,
        updatedAt: new Date()
      });

      setDeploymentStatus('Domain saved! Adding to Vercel project...');
      
      // Notify parent component
      if (onDomainUpdated) {
        onDomainUpdated(cleanDomain);
      }

      // Add domain to existing Vercel project
      await addDomainToProject(cleanDomain);

    } catch (err: any) {
      console.error('Error updating custom domain:', err);
      setError(`Failed to save custom domain: ${err.message}`);
      setDeploymentStatus('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveDomain = async () => {
    if (!currentDomain) return;
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Remove custom domain from Firestore
      const chatbotRef = doc(db, 'chatbots', chatbotId);
      await updateDoc(chatbotRef, {
        domain: '',
        updatedAt: new Date()
      });

      setSuccess('Custom domain removed successfully!');
      setDomain('');
      
      if (onDomainUpdated) {
        onDomainUpdated('');
      }

    } catch (err: any) {
      console.error('Error removing custom domain:', err);
      setError(`Failed to remove custom domain: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Custom Domain Configuration
          {currentDomain && (
            <Badge variant="outline" className="ml-auto">
              <CheckCircle className="h-3 w-3 mr-1" />
              Configured
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Processing Status */}
        {(isLoading || isDeploying) && deploymentStatus && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              <div className="flex items-center gap-2">
                <span>{deploymentStatus}</span>
                {isDeploying && <span className="text-sm text-gray-600">(Usually takes 30-60 seconds)</span>}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Confirmation Dialog */}
        {showConfirmation && (
          <Alert className="border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              <div className="space-y-3">
                <div>
                  <p className="font-medium text-blue-900 mb-2">
                    🌐 Ready to add "{domain}" to your chatbot?
                  </p>
                  <p className="text-sm text-blue-800 mb-3">
                    This will:
                  </p>
                  <ul className="text-sm text-blue-800 list-disc list-inside space-y-1 mb-3">
                    <li>Save your custom domain to the database</li>
                    <li>Add the domain to your existing Vercel project</li>
                    <li>Configure SSL certificate automatically</li>
                    <li>Make your chatbot accessible on the custom domain</li>
                  </ul>
                  <p className="text-xs text-blue-700 bg-blue-100 p-2 rounded">
                    <strong>Important:</strong> Make sure you've added the CNAME record to your DNS provider first!
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={confirmAndSave}
                    disabled={isLoading || isDeploying}
                    className="bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    <Globe className="h-4 w-4 mr-2" />
                    Yes, Add Domain
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowConfirmation(false)}
                    disabled={isLoading || isDeploying}
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="domain">Custom Domain</Label>
            <Input
              id="domain"
              type="text"
              placeholder="chat.yourcompany.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isLoading && !isDeploying && !showConfirmation && domain.trim()) {
                  handleSubmit();
                }
              }}
              disabled={isLoading || isDeploying || showConfirmation}
            />
            <p className="text-sm text-gray-600">
              Enter your custom domain without "https://" (e.g., chat.yourcompany.com)
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              type="button"
              onClick={handleSubmit}
              disabled={isLoading || isDeploying || !domain.trim() || showConfirmation}
              className="flex-1"
            >
              {isLoading || isDeploying ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isDeploying ? 'Adding Domain...' : 'Processing...'}
                </div>
              ) : (
                'Add Custom Domain'
              )}
            </Button>
            
            {currentDomain && (
              <Button 
                type="button"
                variant="outline"
                onClick={handleRemoveDomain}
                disabled={isLoading || isDeploying || showConfirmation}
              >
                Remove
              </Button>
            )}
          </div>
        </div>

        {/* DNS Configuration Instructions */}
        {domain.trim() && validateDomain(domain.trim()) && (
          <>
            <DnsInstructions 
              domain={domain.trim().toLowerCase()} 
              deploymentUrl={deploymentUrl}
              vercelProjectId={vercelProjectId}
            />
            
            <Alert>
              <AlertDescription>
                <div className="mt-3 text-sm">
                  <strong>Next Steps:</strong>
                  <ol className="list-decimal list-inside mt-1 space-y-1 text-sm">
                    <li>Save the custom domain above</li>
                    <li>Add one of the DNS records above to your domain provider</li>
                    <li>Wait for DNS propagation (usually 5-30 minutes)</li>
                    <li>Redeploy your chatbot to apply changes</li>
                    <li>Test your custom domain</li>
                  </ol>
                </div>
                
                <div className="mt-3 p-2 bg-blue-50 rounded text-xs">
                  <strong className="text-blue-800">💡 Pro Tip:</strong> 
                  <span className="text-blue-700"> Use CNAME when possible as it automatically updates if our servers change. Use A record only if your DNS provider doesn't support CNAME for your domain type.</span>
                </div>
              </AlertDescription>
            </Alert>
          </>
        )}

        {/* Help Links */}
        <div className="border-t pt-4">
          <p className="text-sm text-gray-600 mb-2">Need help with DNS configuration?</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a 
                href="https://vercel.com/docs/concepts/projects/custom-domains" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                Vercel Docs <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a 
                href="https://www.namecheap.com/support/knowledgebase/article.aspx/9646/2237/how-to-create-a-cname-record-for-your-domain/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1"
              >
                DNS Setup Guide <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomDomainForm;