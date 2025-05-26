'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Crown, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export const SimpleUsageIndicator: React.FC = () => {
  const { userProfile } = useAuth();
  
  if (!userProfile || userProfile.subscription.plan !== 'free') return null;

  const monthlyQueries = userProfile.usage.monthlyQueries || 0;
  const usagePercentage = (monthlyQueries / 100) * 100;
  const isNearLimit = usagePercentage >= 80;

  return (
    <div className="flex items-center space-x-2">
      <Badge variant="secondary" className="bg-purple-100 text-purple-700">
        <Crown className="h-3 w-3 mr-1" />
        Free Plan
      </Badge>
      <span className="text-sm text-gray-600">
        {monthlyQueries}/100 queries
      </span>
      {isNearLimit && (
        <AlertTriangle className="h-4 w-4 text-amber-500" />
      )}
    </div>
  );
};
