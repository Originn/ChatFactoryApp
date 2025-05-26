'use client';

import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Zap, Crown, AlertTriangle } from 'lucide-react';
import { UserProfile } from '@/types/user';

interface UsageWarningBannerProps {
  user: UserProfile;
  onUpgrade: () => void;
}

export const UsageWarningBanner: React.FC<UsageWarningBannerProps> = ({
  user,
  onUpgrade
}) => {
  const isFree = user.subscription.plan === 'free';
  const queriesUsed = user.usage.monthlyQueries;
  const queriesLimit = 100;
  const usagePercentage = (queriesUsed / queriesLimit) * 100;
  
  if (!isFree || usagePercentage < 80) return null;
  
  return (
    <Alert className="mb-4 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
      <Zap className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex items-center justify-between">
        <span className="text-amber-800">
          {usagePercentage >= 100 ? (
            <strong>Query limit exceeded! Upgrade to continue using your chatbots.</strong>
          ) : (
            <>You've used {queriesUsed}/{queriesLimit} queries this month ({Math.round(usagePercentage)}%)</>
          )}
        </span>
        <Button 
          size="sm" 
          onClick={onUpgrade}
          className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white border-0"
        >
          <Crown className="h-3 w-3 mr-1" />
          Upgrade
        </Button>
      </AlertDescription>
    </Alert>
  );
};

interface DeploymentSuccessCardProps {
  deploymentUrl: string;
  isFreePlan: boolean;
  onUpgrade: () => void;
  onRedeploy: () => void;
  onDelete: () => void;
  onCopyUrl: () => void;
}

export const DeploymentSuccessCard: React.FC<DeploymentSuccessCardProps> = ({
  deploymentUrl,
  isFreePlan,
  onUpgrade,
  onRedeploy,
  onDelete,
  onCopyUrl
}) => {
  return (
    <Alert className="border-green-200 bg-green-50">
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <Crown className="h-4 w-4 text-white" />
          </div>
        </div>
        
        <div className="flex-grow space-y-4">
          <div>
            <h3 className="text-lg font-medium text-green-800 mb-2">
              🎉 Deployment Successful!
            </h3>
            <p className="text-green-700 text-sm">
              Your chatbot is now live and ready to help your users.
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Your chatbot is live at:</p>
                <p className="font-mono text-lg text-blue-600 break-all">{deploymentUrl}</p>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCopyUrl}
                  className="flex-shrink-0"
                >
                  Copy URL
                </Button>
                <Button
                  size="sm"
                  onClick={() => window.open(deploymentUrl, '_blank')}
                  className="flex-shrink-0"
                >
                  Visit Live Site
                </Button>
              </div>
            </div>
          </div>

          {isFreePlan && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Your chatbot includes "Powered by ChatFactory" branding. 
                <button 
                  className="text-blue-700 underline ml-1 font-medium"
                  onClick={onUpgrade}
                >
                  Upgrade to Pro to remove branding and unlock more features
                </button>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onRedeploy}>
              Redeploy
            </Button>
            <Button variant="outline" onClick={onDelete} className="text-red-600 hover:bg-red-50">
              Delete Deployment
            </Button>
          </div>
        </div>
      </div>
    </Alert>
  );
};
