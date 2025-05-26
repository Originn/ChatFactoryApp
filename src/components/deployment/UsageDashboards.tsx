'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, 
  Zap, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  Crown,
  Calendar,
  Activity
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

// Usage Overview Component for Dashboard
export const UsageOverviewCard: React.FC = () => {
  const { user, userProfile } = useAuth();
  
  if (!userProfile || userProfile.subscription.plan !== 'free') return null;

  const monthlyQueries = userProfile.usage.monthlyQueries || 0;
  const monthlyLimit = 100;
  const usagePercentage = (monthlyQueries / monthlyLimit) * 100;
  const queriesRemaining = monthlyLimit - monthlyQueries;
  const isNearLimit = usagePercentage >= 80;

  const getNextResetDate = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const daysUntilReset = Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilReset === 1) {
      return 'tomorrow';
    } else if (daysUntilReset < 7) {
      return `in ${daysUntilReset} days`;
    } else {
      return nextMonth.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Free Plan Usage
          </div>
          <Badge variant="secondary" className="bg-purple-100 text-purple-700">
            <Crown className="h-3 w-3 mr-1" />
            Free Plan
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Monthly Queries Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Monthly Queries</span>
            <span className="text-sm text-gray-600">
              {monthlyQueries} / {monthlyLimit}
            </span>
          </div>
          
          <div className="space-y-2">
            <Progress 
              value={usagePercentage} 
              className={`h-3 ${usagePercentage >= 100 ? 'bg-red-100' : isNearLimit ? 'bg-amber-100' : 'bg-blue-100'}`}
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>{queriesRemaining} remaining</span>
              <span>Resets {getNextResetDate()}</span>
            </div>
          </div>
        </div>

        {/* Usage Breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-xl font-bold text-blue-600">{userProfile.usage.chatbotsCreated || 0}/2</div>
            <div className="text-xs text-gray-600">Chatbots</div>
          </div>
          
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-xl font-bold text-green-600">{userProfile.usage.totalQueries || 0}</div>
            <div className="text-xs text-gray-600">Total Queries</div>
          </div>
        </div>

        {/* Free Tier Benefits */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200">
          <h3 className="font-medium text-sm mb-2">What's Included in Free Plan</h3>
          <ul className="text-xs text-gray-700 space-y-1">
            <li>✅ 2 chatbot deployments</li>
            <li>✅ 100 queries per month</li>
            <li>✅ Vercel subdomain hosting</li>
            <li>✅ Basic analytics (7 days)</li>
            <li>⚠️ "Powered by ChatFactory" branding</li>
          </ul>
        </div>

        {/* Upgrade Prompt */}
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg">
          <div>
            <div className="text-sm font-medium">Need More Power?</div>
            <div className="text-xs text-gray-600">Unlock unlimited chatbots & 2,000 queries/month</div>
          </div>
          <Button 
            size="sm"
            className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
            onClick={() => window.location.href = '/dashboard/settings/billing'}
          >
            <Crown className="h-3 w-3 mr-1" />
            Upgrade
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Simple Usage Analytics Component
export const UsageAnalyticsChart: React.FC = () => {
  const { userProfile } = useAuth();
  
  if (!userProfile || userProfile.subscription.plan !== 'free') return null;

  // Mock daily usage data - in real app, this would come from the tracking service
  const dailyUsage = [
    { day: 'Mon', queries: 3 },
    { day: 'Tue', queries: 7 },
    { day: 'Wed', queries: 2 },
    { day: 'Thu', queries: 8 },
    { day: 'Fri', queries: 12 },
    { day: 'Sat', queries: 5 },
    { day: 'Sun', queries: 1 }
  ];

  const maxQueries = Math.max(...dailyUsage.map(d => d.queries));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          This Week's Usage
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Simple Bar Chart */}
        <div className="space-y-2">
          <div className="grid grid-cols-7 gap-2 h-24">
            {dailyUsage.map((day, index) => {
              const height = maxQueries > 0 ? (day.queries / maxQueries) * 100 : 0;
              
              return (
                <div key={index} className="flex flex-col items-center">
                  <div className="flex-1 flex flex-col justify-end">
                    <div 
                      className="bg-blue-500 rounded-t w-full min-h-[4px]"
                      style={{ height: `${Math.max(height, 5)}%` }}
                      title={`${day.day}: ${day.queries} queries`}
                    />
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {day.day}
                  </div>
                  <div className="text-xs text-gray-500">
                    {day.queries}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Summary */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-blue-600">
              {dailyUsage.reduce((sum, day) => sum + day.queries, 0)}
            </div>
            <div className="text-xs text-gray-600">This Week</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">
              {Math.round(dailyUsage.reduce((sum, day) => sum + day.queries, 0) / 7)}
            </div>
            <div className="text-xs text-gray-600">Daily Avg</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-600">
              {Math.max(...dailyUsage.map(d => d.queries))}
            </div>
            <div className="text-xs text-gray-600">Peak Day</div>
          </div>
        </div>

        {/* Usage Tips for Free Users */}
        <div className="bg-blue-50 p-3 rounded-lg">
          <h4 className="text-sm font-medium text-blue-800 mb-1">💡 Usage Tips</h4>
          <p className="text-xs text-blue-700">
            Your usage resets on the 1st of each month. Pro users get 20x more queries and never worry about limits!
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
