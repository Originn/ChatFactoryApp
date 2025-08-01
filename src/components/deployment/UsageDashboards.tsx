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
  const isAtLimit = usagePercentage >= 100;

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
    <Card variant="elevated" className="animate-fade-in">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Usage Overview</h3>
              <p className="text-sm text-gray-500">Track your free plan limits</p>
            </div>
          </div>
          <Badge className="bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 border border-purple-200 shadow-sm">
            <Crown className="h-3 w-3 mr-1" />
            Free Plan
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Monthly Queries Progress */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gradient-to-br from-green-400 to-green-500 rounded-lg flex items-center justify-center">
                <Activity className="h-3 w-3 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-800">Monthly Queries</span>
            </div>
            <span className={`text-sm font-bold ${
              isAtLimit ? 'text-red-600' : isNearLimit ? 'text-amber-600' : 'text-gray-800'
            }`}>
              {monthlyQueries} / {monthlyLimit}
            </span>
          </div>
          
          <div className="space-y-3">
            <div className="relative">
              <Progress 
                value={Math.min(usagePercentage, 100)} 
                className={`h-4 transition-all duration-300 ${
                  isAtLimit ? 'bg-red-50' : isNearLimit ? 'bg-amber-50' : 'bg-blue-50'
                }`}
              />
              {isAtLimit && (
                <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-red-500 rounded-full animate-pulse-soft" />
              )}
            </div>
            <div className="flex justify-between text-xs">
              <span className={`font-medium ${
                queriesRemaining <= 0 ? 'text-red-600' : queriesRemaining <= 20 ? 'text-amber-600' : 'text-gray-600'
              }`}>
                {queriesRemaining > 0 ? `${queriesRemaining} remaining` : 'Limit reached'}
              </span>
              <span className="text-gray-500">Resets {getNextResetDate()}</span>
            </div>
          </div>
        </div>

        {/* Usage Breakdown */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200/50 text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {userProfile.usage.chatbotsCreated || 0}/2
            </div>
            <div className="text-xs font-medium text-blue-700">Chatbots Created</div>
            <div className="text-xs text-gray-600 mt-1">
              {2 - (userProfile.usage.chatbotsCreated || 0)} remaining
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200/50 text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {userProfile.usage.totalQueries || 0}
            </div>
            <div className="text-xs font-medium text-green-700">Total Queries</div>
            <div className="text-xs text-gray-600 mt-1">All time</div>
          </div>
        </div>

        {/* Free Tier Benefits */}
        <div className="bg-gradient-to-br from-purple-25 to-blue-25 p-5 rounded-xl border border-purple-200/30">
          <div className="flex items-center mb-3">
            <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mr-2">
              <Crown className="h-3 w-3 text-white" />
            </div>
            <h3 className="font-semibold text-sm text-gray-900">Free Plan Includes</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="flex items-center text-green-700 bg-green-50 rounded-lg px-2 py-1">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2 flex items-center justify-center">
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 8 8">
                  <path d="M6.564.75l-3.59 3.612-1.538-1.55L0 4.26l2.974 2.99L8 2.193z"/>
                </svg>
              </div>
              2 chatbot deployments
            </div>
            <div className="flex items-center text-green-700 bg-green-50 rounded-lg px-2 py-1">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2 flex items-center justify-center">
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 8 8">
                  <path d="M6.564.75l-3.59 3.612-1.538-1.55L0 4.26l2.974 2.99L8 2.193z"/>
                </svg>
              </div>
              100 queries per month
            </div>
            <div className="flex items-center text-green-700 bg-green-50 rounded-lg px-2 py-1">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2 flex items-center justify-center">
                <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 8 8">
                  <path d="M6.564.75l-3.59 3.612-1.538-1.55L0 4.26l2.974 2.99L8 2.193z"/>
                </svg>
              </div>
              Vercel subdomain hosting
            </div>
            <div className="flex items-center text-amber-700 bg-amber-50 rounded-lg px-2 py-1">
              <div className="w-3 h-3 bg-amber-500 rounded-full mr-2 flex items-center justify-center text-white text-[8px]">
                !
              </div>
              "Powered by ChatFactory" branding
            </div>
          </div>
        </div>

        {/* Upgrade Prompt */}
        <div className="bg-gradient-to-br from-purple-500 to-blue-600 p-5 rounded-xl text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <Crown className="h-5 w-5 mr-2 text-yellow-300" />
                <div className="text-sm font-semibold">Need More Power?</div>
              </div>
              <div className="text-xs text-purple-100 mb-3">
                Unlimited chatbots • 2,000 queries/month • Custom domains
              </div>
            </div>
          </div>
          <Button 
            size="sm"
            variant="secondary"
            className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm font-medium shadow-lg"
            onClick={() => window.location.href = '/dashboard/settings/billing'}
          >
            <Crown className="h-3 w-3 mr-2" />
            Upgrade to Pro Plan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// Enhanced Usage Analytics Component
export const UsageAnalyticsChart: React.FC = () => {
  const { userProfile } = useAuth();
  
  if (!userProfile || userProfile.subscription.plan !== 'free') return null;

  // Mock daily usage data - in real app, this would come from the tracking service
  const dailyUsage = [
    { day: 'Mon', queries: 3, date: 'Oct 21' },
    { day: 'Tue', queries: 7, date: 'Oct 22' },
    { day: 'Wed', queries: 2, date: 'Oct 23' },
    { day: 'Thu', queries: 8, date: 'Oct 24' },
    { day: 'Fri', queries: 12, date: 'Oct 25' },
    { day: 'Sat', queries: 5, date: 'Oct 26' },
    { day: 'Sun', queries: 1, date: 'Oct 27' }
  ];

  const maxQueries = Math.max(...dailyUsage.map(d => d.queries));
  const totalWeekQueries = dailyUsage.reduce((sum, day) => sum + day.queries, 0);
  const avgDaily = Math.round(totalWeekQueries / 7);
  const peakDay = Math.max(...dailyUsage.map(d => d.queries));

  return (
    <Card variant="elevated" className="animate-fade-in">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Weekly Analytics</h3>
              <p className="text-sm text-gray-500">Your query patterns this week</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Last 7 Days
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Enhanced Bar Chart */}
        <div className="space-y-4">
          <div className="grid grid-cols-7 gap-3 h-32 items-end bg-gradient-to-t from-gray-50 to-transparent rounded-xl p-4">
            {dailyUsage.map((day, index) => {
              const height = maxQueries > 0 ? (day.queries / maxQueries) * 100 : 0;
              const isToday = index === 6; // Assume Sunday is today for demo
              
              return (
                <div key={index} className="flex flex-col items-center space-y-2 group">
                  <div className="flex-1 flex flex-col justify-end w-full">
                    <div 
                      className={`rounded-t-lg w-full min-h-[8px] transition-all duration-300 group-hover:opacity-80 ${
                        isToday 
                          ? 'bg-gradient-to-t from-purple-500 to-purple-400 shadow-lg shadow-purple-500/30' 
                          : day.queries >= 8 
                          ? 'bg-gradient-to-t from-blue-500 to-blue-400 shadow-md shadow-blue-500/20'
                          : day.queries >= 5
                          ? 'bg-gradient-to-t from-green-500 to-green-400 shadow-md shadow-green-500/20'
                          : 'bg-gradient-to-t from-gray-400 to-gray-300'
                      }`}
                      style={{ height: `${Math.max(height, 10)}%` }}
                      title={`${day.date}: ${day.queries} queries`}
                    />
                  </div>
                  <div className="text-center">
                    <div className={`text-xs font-medium ${
                      isToday ? 'text-purple-600' : 'text-gray-600'
                    }`}>
                      {day.day}
                    </div>
                    <div className={`text-xs font-bold ${
                      isToday ? 'text-purple-700' : day.queries >= 8 ? 'text-blue-600' : 'text-gray-500'
                    }`}>
                      {day.queries}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Enhanced Weekly Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200/50 text-center">
            <div className="text-2xl font-bold text-blue-600 mb-1">{totalWeekQueries}</div>
            <div className="text-xs font-medium text-blue-700">This Week</div>
            <div className="text-xs text-gray-600 mt-1">Total queries</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200/50 text-center">
            <div className="text-2xl font-bold text-green-600 mb-1">{avgDaily}</div>
            <div className="text-xs font-medium text-green-700">Daily Average</div>
            <div className="text-xs text-gray-600 mt-1">Per day</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200/50 text-center">
            <div className="text-2xl font-bold text-purple-600 mb-1">{peakDay}</div>
            <div className="text-xs font-medium text-purple-700">Peak Day</div>
            <div className="text-xs text-gray-600 mt-1">Highest usage</div>
          </div>
        </div>

        {/* Enhanced Usage Tips */}
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-5 rounded-xl text-white shadow-lg">
          <div className="flex items-center mb-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mr-3">
              <TrendingUp className="h-4 w-4 text-yellow-300" />
            </div>
            <h4 className="text-sm font-semibold">💡 Usage Insights</h4>
          </div>
          <div className="space-y-2 text-xs text-blue-100">
            <p>• Your usage resets on the 1st of each month</p>
            <p>• Pro users get 2,000 queries/month (20x more!)</p>
            <p>• Peak usage typically happens on weekdays</p>
          </div>
          <div className="mt-4 pt-3 border-t border-white/20">
            <div className="flex items-center justify-between text-xs">
              <span className="text-blue-100">Monthly Progress</span>
              <span className="font-semibold">
                {userProfile.usage.monthlyQueries || 0}/100 queries used
              </span>
            </div>
            <div className="mt-2 bg-white/20 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-yellow-300 to-yellow-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(((userProfile.usage.monthlyQueries || 0) / 100) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
