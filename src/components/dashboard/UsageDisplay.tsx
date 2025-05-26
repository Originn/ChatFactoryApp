// src/components/dashboard/UsageDisplay.tsx
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crown, AlertTriangle, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Simple usage display component for free tier users
export const UsageDisplay: React.FC = () => {
  const { userProfile } = useAuth();
  
  if (!userProfile || userProfile.subscription.plan !== 'free') return null;

  const monthlyQueries = userProfile.usage.monthlyQueries || 0;
  const monthlyLimit = 100;
  const usagePercentage = (monthlyQueries / monthlyLimit) * 100;
  const queriesRemaining = monthlyLimit - monthlyQueries;
  
  const chatbotsUsed = userProfile.usage.chatbotsCreated || 0;
  const chatbotLimit = 2;
  
  const isNearQueryLimit = usagePercentage >= 80;
  const isAtQueryLimit = usagePercentage >= 100;
  const isNearChatbotLimit = chatbotsUsed >= chatbotLimit;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-sm font-medium">Free Plan Usage</span>
          <Badge variant="secondary" className="bg-purple-100 text-purple-700">
            <Crown className="h-3 w-3 mr-1" />
            Free
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Query Usage */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Monthly Queries</span>
            <span className={`text-xs font-medium ${
              isAtQueryLimit ? 'text-red-600' : 
              isNearQueryLimit ? 'text-amber-600' : 'text-gray-800'
            }`}>
              {monthlyQueries}/{monthlyLimit}
            </span>
          </div>
          <Progress 
            value={usagePercentage} 
            className={`h-2 ${
              isAtQueryLimit ? 'bg-red-100' : 
              isNearQueryLimit ? 'bg-amber-100' : 'bg-blue-100'
            }`}
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{queriesRemaining} remaining</span>
            <span>Resets monthly</span>
          </div>
        </div>

        {/* Chatbot Usage */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-600">Chatbots</span>
            <span className={`text-xs font-medium ${
              isNearChatbotLimit ? 'text-amber-600' : 'text-gray-800'
            }`}>
              {chatbotsUsed}/{chatbotLimit}
            </span>
          </div>
          <Progress 
            value={(chatbotsUsed / chatbotLimit) * 100} 
            className="h-2 bg-purple-100"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{chatbotLimit - chatbotsUsed} remaining</span>
            <span>Lifetime limit</span>
          </div>
        </div>

        {/* Warning Messages */}
        {(isNearQueryLimit || isNearChatbotLimit) && (
          <div className="pt-2 border-t">
            <div className="flex items-center space-x-2 text-xs">
              <AlertTriangle className={`h-3 w-3 ${
                isAtQueryLimit ? 'text-red-500' : 'text-amber-500'
              }`} />
              <span className={`${
                isAtQueryLimit ? 'text-red-700' : 'text-amber-700'
              }`}>
                {isAtQueryLimit ? 'Monthly limit reached!' : 
                 isNearQueryLimit ? 'Approaching monthly limit' : 
                 'Chatbot limit reached'}
              </span>
            </div>
          </div>
        )}

        {/* Upgrade Button */}
        <Button 
          size="sm" 
          className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
          onClick={() => window.location.href = '/dashboard/settings/billing'}
        >
          <TrendingUp className="h-3 w-3 mr-2" />
          Upgrade to Pro
        </Button>
      </CardContent>
    </Card>
  );
};