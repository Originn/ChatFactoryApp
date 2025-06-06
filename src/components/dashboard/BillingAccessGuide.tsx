'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Crown, ArrowRight, Settings, CreditCard, X } from 'lucide-react';
import Link from 'next/link';

export const BillingAccessGuide: React.FC = () => {
  const [showGuide, setShowGuide] = useState(true);

  if (!showGuide) return null;

  return (
    <Alert className="mb-6 border-blue-200 bg-blue-50">
      <CreditCard className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-blue-800">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="font-medium mb-2">💡 How to access billing and upgrade options:</div>
            <div className="flex items-center space-x-2 text-sm">
              <Badge variant="outline" className="text-xs">Dashboard</Badge>
              <ArrowRight className="h-3 w-3" />
              <Badge variant="outline" className="text-xs">Settings</Badge>
              <ArrowRight className="h-3 w-3" />
              <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700">
                <Crown className="h-3 w-3 mr-1" />
                Billing Tab
              </Badge>
            </div>
            <div className="mt-2 text-sm">
              Or click the <span className="font-medium text-purple-600">"Upgrade"</span> link in the top navigation
            </div>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <Link href="/dashboard/settings/billing">
              <Button size="sm" className="bg-gradient-to-r from-purple-500 to-blue-600">
                <Crown className="h-3 w-3 mr-1" />
                Go to Billing
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setShowGuide(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};
