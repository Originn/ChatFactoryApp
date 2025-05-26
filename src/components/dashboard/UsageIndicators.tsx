'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Crown, AlertTriangle, Zap } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Simple usage indicator for dashboard header
export const UsageIndicator: React.FC = () => {
  const { userProfile } = useAuth();
  
  if (!userProfile || userProfile.subscription.plan !== 'free') return null;

  const monthlyQueries = userProfile.usage.monthlyQueries || 0;
  const monthlyLimit = 100;
  const usagePercentage = (monthlyQueries / monthlyLimit) * 100;
  const isNearLimit = usagePercentage >= 80;
  const isAtLimit = usagePercentage >= 100;

  return (
    <div className="flex items-center space-x-3">
      {/* Plan Badge */}
      <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
        <Crown className="h-3 w-3 mr-1" />
        Free Plan
      </Badge>

      {/* Usage Progress */}
      <div className="flex items-center space-x-2">
        <span className="text-xs text-gray-600">Queries:</span>
        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${
              isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${
          isAtLimit ? 'text-red-600' : isNearLimit ? 'text-amber-600' : 'text-gray-600'
        }`}>
          {monthlyQueries}/100
        </span>
      </div>

      {/* Alert Icon for Near/At Limit */}
      {isNearLimit && (
        <AlertTriangle className={`h-4 w-4 ${isAtLimit ? 'text-red-500' : 'text-amber-500'}`} />
      )}
    </div>
  );
};

// Usage warning banner for dashboard
export const UsageWarningBanner: React.FC<{ onUpgrade: () => void }> = ({ onUpgrade }) => {
  const { userProfile } = useAuth();
  
  if (!userProfile || userProfile.subscription.plan !== 'free') return null;

  const monthlyQueries = userProfile.usage.monthlyQueries || 0;
  const usagePercentage = (monthlyQueries / 100) * 100;
  
  if (usagePercentage < 80) return null;

  const isAtLimit = usagePercentage >= 100;
  
  return (
    <Card className={`mb-6 border-2 ${isAtLimit ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${isAtLimit ? 'bg-red-100' : 'bg-amber-100'}`}>
              {isAtLimit ? (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              ) : (
                <Zap className="h-5 w-5 text-amber-600" />
              )}
            </div>
            <div>
              <h3 className={`font-medium ${isAtLimit ? 'text-red-800' : 'text-amber-800'}`}>
                {isAtLimit ? 'Monthly Limit Reached!' : 'Approaching Monthly Limit'}
              </h3>
              <p className={`text-sm ${isAtLimit ? 'text-red-700' : 'text-amber-700'}`}>
                {isAtLimit ? (
                  'Your chatbots are paused. Upgrade to continue serving users.'
                ) : (
                  `You've used ${Math.round(usagePercentage)}% of your monthly queries (${monthlyQueries}/100).`
                )}
              </p>
            </div>
          </div>
          <Button 
            onClick={onUpgrade}
            className={`${
              isAtLimit 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700'
            }`}
          >
            <Crown className="h-4 w-4 mr-2" />
            {isAtLimit ? 'Upgrade Now' : 'Upgrade to Pro'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Simple usage card for dashboard
export const UsageCard: React.FC = () => {
  const { userProfile } = useAuth();
  
  if (!userProfile || userProfile.subscription.plan !== 'free') return null;

  const monthlyQueries = userProfile.usage.monthlyQueries || 0;
  const chatbotsUsed = userProfile.usage.chatbotsCreated || 0;
  const queriesRemaining = 100 - monthlyQueries;
  const usagePercentage = (monthlyQueries / 100) * 100;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm">Free Plan Usage</h3>
          <Badge variant="secondary" className="bg-purple-100 text-purple-700 text-xs">
            <Crown className="h-3 w-3 mr-1" />
            Free
          </Badge>
        </div>
        
        <div className="space-y-3">
          {/* Monthly Queries */}
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Monthly Queries</span>
              <span>{monthlyQueries}/100</span>
            </div>
            <Progress value={usagePercentage} className="h-2" />
            <p className="text-xs text-gray-500 mt-1">
              {queriesRemaining} queries remaining this month
            </p>
          </div>

          {/* Chatbots */}
          <div>
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Chatbots</span>
              <span>{chatbotsUsed}/2</span>
            </div>
            <Progress value={(chatbotsUsed / 2) * 100} className="h-2" />
            <p className="text-xs text-gray-500 mt-1">
              {2 - chatbotsUsed} chatbot slots remaining
            </p>
          </div>

          {/* Upgrade Button */}
          <Button 
            size="sm" 
            className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
            onClick={() => window.location.href = '/dashboard/settings'}
          >
            <Crown className="h-3 w-3 mr-1" />
            Upgrade to Pro
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
