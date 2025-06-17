// DEBUG: Complete custom domain management component integrating form and status
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Settings, Activity, ExternalLink } from "lucide-react";

import CustomDomainForm from './CustomDomainForm';
import CustomDomainStatus from './CustomDomainStatus';

interface CustomDomainManagerProps {
  chatbotId: string;
  chatbotName?: string;
  currentDomain?: string;
  vercelProjectId?: string;
  firebaseProjectId?: string;
  deploymentUrl?: string;
  onDomainChange?: (domain: string) => void;
}

const CustomDomainManager: React.FC<CustomDomainManagerProps> = ({
  chatbotId,
  chatbotName = 'Your Chatbot',
  currentDomain = '',
  vercelProjectId,
  firebaseProjectId,
  deploymentUrl,
  onDomainChange
}) => {
  const [domain, setDomain] = useState(currentDomain);
  const [isDeployed, setIsDeployed] = useState(!!vercelProjectId && !!deploymentUrl);

  const handleDomainUpdated = (newDomain: string) => {
    setDomain(newDomain);
    if (onDomainChange) {
      onDomainChange(newDomain);
    }
  };

  const getDeploymentStatus = () => {
    if (!isDeployed) {
      return { variant: 'secondary' as const, text: 'Not Deployed', icon: null };
    }
    
    if (domain && isDeployed) {
      return { variant: 'default' as const, text: 'Custom Domain Active', icon: Globe };
    }
    
    return { variant: 'default' as const, text: 'Deployed', icon: Activity };
  };

  const deploymentStatus = getDeploymentStatus();

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Custom Domain Management
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Configure a custom domain for {chatbotName}
              </p>
            </div>
            <Badge 
              variant={deploymentStatus.variant}
              className="flex items-center gap-1"
            >
              {deploymentStatus.icon && <deploymentStatus.icon className="h-3 w-3" />}
              {deploymentStatus.text}
            </Badge>
          </div>
        </CardHeader>
        
        {/* Quick Overview */}
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Current Domain:</span>
              <div className="mt-1">
                {domain ? (
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">{domain}</code>
                ) : (
                  <span className="text-gray-500">Not configured</span>
                )}
              </div>
            </div>
            
            {deploymentUrl && (
              <div>
                <span className="font-medium">Vercel URL:</span>
                <div className="mt-1">
                  <a 
                    href={deploymentUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs flex items-center gap-1"
                  >
                    {new URL(deploymentUrl).hostname}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}
            
            <div>
              <span className="font-medium">Status:</span>
              <div className="mt-1">
                {domain ? (
                  <span className="text-blue-600 text-xs">Custom domain configured</span>
                ) : (
                  <span className="text-gray-500 text-xs">Using Vercel domain</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="configure" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="configure" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configure Domain
          </TabsTrigger>
          <TabsTrigger value="status" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Domain Status
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="configure" className="space-y-4">
          <CustomDomainForm
            chatbotId={chatbotId}
            currentDomain={domain}
            vercelProjectId={vercelProjectId}
            deploymentUrl={deploymentUrl}
            onDomainUpdated={handleDomainUpdated}
          />
        </TabsContent>
        
        <TabsContent value="status" className="space-y-4">
          {domain ? (
            <CustomDomainStatus
              chatbotId={chatbotId}
              customDomain={domain}
              vercelProjectId={vercelProjectId}
              firebaseProjectId={firebaseProjectId}
            />
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Globe className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Custom Domain Configured
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Configure a custom domain in the "Configure Domain" tab to see detailed status information.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      const tabTrigger = document.querySelector('[value="configure"]') as HTMLElement;
                      tabTrigger?.click();
                    }}
                  >
                    Configure Domain
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Setup Guide</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                1
              </div>
              <div>
                <p className="font-medium">Configure Custom Domain</p>
                <p className="text-gray-600">Enter your domain in the "Configure Domain" tab</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                2
              </div>
              <div>
                <p className="font-medium">Configure DNS</p>
                <p className="text-gray-600">Set up CNAME or A records with your domain provider</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-xs">
                3
              </div>
              <div>
                <p className="font-medium">Verify & Monitor</p>
                <p className="text-gray-600">Check status and verify domain is working correctly</p>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-500">
              Need help? Check our{' '}
              <a href="https://docs.chatfactory.ai/custom-domains" className="text-blue-600 hover:underline">
                documentation
              </a>{' '}
              or{' '}
              <a href="mailto:support@chatfactory.ai" className="text-blue-600 hover:underline">
                contact support
              </a>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomDomainManager;