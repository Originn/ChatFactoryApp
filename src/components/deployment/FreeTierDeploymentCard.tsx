'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Zap, 
  Crown, 
  ExternalLink, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Globe,
  Copy,
  RefreshCw
} from 'lucide-react';
import { UserProfile } from '@/types/user';
import { ChatbotConfig } from '@/types/chatbot';

interface FreeTierDeploymentCardProps {
  user: UserProfile;
  chatbot: ChatbotConfig;
  onDeploy: () => Promise<void>;
  onUpgrade: () => void;
}

export const FreeTierDeploymentCard: React.FC<FreeTierDeploymentCardProps> = ({
  user,
  chatbot,
  onDeploy,
  onUpgrade
}) => {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState(0);
  const [showLimitsModal, setShowLimitsModal] = useState(false);

  const isFree = user.subscription.plan === 'free';
  const hasExceededChatbots = user.usage.chatbotsCreated >= 2;
  const monthlyQueriesUsed = user.usage.monthlyQueries;
  const queriesRemaining = 100 - monthlyQueriesUsed;
  const isNearLimit = queriesRemaining < 20;

  const handleDeploy = async () => {
    if (hasExceededChatbots && isFree) {
      setShowLimitsModal(true);
      return;
    }

    setIsDeploying(true);
    setDeploymentProgress(0);

    try {
      // Simulate deployment progress
      const progressInterval = setInterval(() => {
        setDeploymentProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      await onDeploy();
      
      // Complete progress
      setDeploymentProgress(100);
      clearInterval(progressInterval);
      
    } catch (error) {
      console.error('Deployment failed:', error);
    } finally {
      setTimeout(() => {
        setIsDeploying(false);
        setDeploymentProgress(0);
      }, 1000);
    }
  };

  const generatePreviewUrl = () => {
    const subdomain = chatbot.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return `${subdomain}.vercel.app`;
  };

  if (isDeploying) {
    return (
      <Card className="relative overflow-hidden">
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Globe className="h-8 w-8 text-white animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Deploying your chatbot...</h3>
              <p className="text-gray-600 text-sm">This usually takes 2-3 minutes</p>
            </div>

            <div className="w-full max-w-xs mx-auto space-y-2">
              <Progress value={deploymentProgress} className="h-3" />
              <p className="text-xs text-gray-500">{deploymentProgress}% complete</p>
            </div>

            <div className="text-xs text-gray-600 space-y-1">
              <div className={deploymentProgress >= 20 ? 'text-green-600' : ''}>
                ✓ Creating Vercel project
              </div>
              <div className={deploymentProgress >= 40 ? 'text-green-600' : ''}>
                ✓ Configuring environment
              </div>
              <div className={deploymentProgress >= 60 ? 'text-green-600' : ''}>
                ✓ Building application
              </div>
              <div className={deploymentProgress >= 80 ? 'text-green-600' : ''}>
                ✓ Deploying to edge network
              </div>
              <div className={deploymentProgress >= 100 ? 'text-green-600' : ''}>
                ✓ Going live!
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="relative">
        {isFree && (
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="text-xs bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700">
              <Crown className="h-3 w-3 mr-1" />
              Free Plan
            </Badge>
          </div>
        )}
        
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Deploy to Vercel
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Free Tier Status */}
          {isFree && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <h3 className="font-medium text-sm">Free Plan Deployment</h3>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Free Vercel subdomain ({generatePreviewUrl()})
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      Full AI chat functionality
                    </li>
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      "Powered by ChatFactory" branding
                    </li>
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      100 queries/month limit
                    </li>
                  </ul>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onUpgrade}
                  className="text-xs bg-gradient-to-r from-purple-500 to-blue-600 text-white border-0 hover:from-purple-600 hover:to-blue-700"
                >
                  <Crown className="h-3 w-3 mr-1" />
                  Upgrade
                </Button>
              </div>
            </div>
          )}

          {/* Usage Limits Warning */}
          {isFree && isNearLimit && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                You have {queriesRemaining} queries remaining this month. 
                <button 
                  className="text-amber-700 underline ml-1 font-medium"
                  onClick={onUpgrade}
                >
                  Upgrade for unlimited queries
                </button>
              </AlertDescription>
            </Alert>
          )}

          {/* Deployment Preview */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="text-sm font-medium mb-2">Deployment Preview</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>URL:</span>
                <span className="font-mono text-blue-600">{generatePreviewUrl()}</span>
              </div>
              <div className="flex justify-between">
                <span>Custom Domain:</span>
                <span>{isFree ? '❌ Pro only' : '✅ Available'}</span>
              </div>
              <div className="flex justify-between">
                <span>Branding:</span>
                <span>{isFree ? '🏷️ ChatFactory branded' : '✅ Your branding'}</span>
              </div>
            </div>
          </div>

          {/* Deployment Button */}
          <div className="space-y-2">
            <Button 
              onClick={handleDeploy}
              disabled={hasExceededChatbots && isFree}
              className="w-full"
              size="lg"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Deploy to Vercel
            </Button>

            {hasExceededChatbots && isFree && (
              <p className="text-xs text-center text-gray-500">
                Free plan: 2/2 chatbots used. 
                <button 
                  className="text-blue-600 underline ml-1"
                  onClick={onUpgrade}
                >
                  Upgrade to deploy more
                </button>
              </p>
            )}
          </div>

          {/* What happens after deployment */}
          {isFree && (
            <div className="border-t pt-3">
              <details className="text-xs text-gray-600">
                <summary className="cursor-pointer font-medium mb-2">
                  What happens after deployment?
                </summary>
                <ul className="space-y-1 ml-4 mt-2">
                  <li>• Your chatbot will be live at {generatePreviewUrl()}</li>
                  <li>• Users can chat with your AI assistant</li>
                  <li>• Basic analytics available (7-day history)</li>
                  <li>• 100 queries/month limit applies</li>
                  <li>• ChatFactory branding will appear</li>
                </ul>
              </details>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Limits Exceeded Modal */}
      {showLimitsModal && (
        <FreeTierLimitsModal 
          onClose={() => setShowLimitsModal(false)}
          onUpgrade={onUpgrade}
        />
      )}
    </>
  );
};

// Free Tier Limits Modal Component
interface FreeTierLimitsModalProps {
  onClose: () => void;
  onUpgrade: () => void;
}

const FreeTierLimitsModal: React.FC<FreeTierLimitsModalProps> = ({
  onClose,
  onUpgrade
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center mb-3">
            <Crown className="h-6 w-6 text-white" />
          </div>
          <CardTitle>Free Plan Limit Reached</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-center text-gray-600 text-sm">
            You've reached your free plan limit of 2 chatbots. 
            Upgrade to Pro to deploy unlimited chatbots!
          </div>

          <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-sm mb-2">Pro Plan Benefits:</h3>
            <ul className="text-xs space-y-1 text-gray-700">
              <li>✅ Unlimited chatbot deployments</li>
              <li>✅ Custom domains</li>
              <li>✅ Remove ChatFactory branding</li>
              <li>✅ Advanced analytics (90 days)</li>
              <li>✅ 2,000 queries/month</li>
              <li>✅ Priority support</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Maybe Later
            </Button>
            <Button 
              onClick={onUpgrade}
              className="flex-1 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
            >
              <Crown className="h-4 w-4 mr-2" />
              Upgrade Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
