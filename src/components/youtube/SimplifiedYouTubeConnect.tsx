// YouTube Component - authentication removed
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Youtube, AlertCircle } from 'lucide-react';

interface SimplifiedYouTubeConnectProps {
  userId: string;
  onConnectionChange?: (isConnected: boolean) => void;
}

export default function SimplifiedYouTubeConnect({
  userId,
  onConnectionChange
}: SimplifiedYouTubeConnectProps) {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
          <Youtube className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <CardTitle className="text-xl font-semibold">
          YouTube Integration
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <Alert className="border-red-200 bg-red-50 dark:bg-red-950/50 dark:border-red-800">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            YouTube authentication has been temporarily removed due to technical issues. 
            This feature will be restored soon with a better implementation.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}