'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Globe, 
  Settings, 
  BarChart3, 
  Crown,
  ExternalLink,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { ChatbotConfig } from '@/types/chatbot';
import { UpdatedUserProfile } from '@/types/deployment';
import Link from 'next/link';

interface ChatbotCardWithDeploymentProps {
  chatbot: ChatbotConfig;
  user: UpdatedUserProfile;
  deploymentStatus?: 'none' | 'deploying' | 'deployed' | 'failed';
  deploymentUrl?: string;
}

export const ChatbotCardWithDeployment: React.FC<ChatbotCardWithDeploymentProps> = ({
  chatbot,
  user,
  deploymentStatus = 'none',
  deploymentUrl
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isFree = user.subscription.plan === 'free';

  const getStatusIcon = () => {
    switch (deploymentStatus) {
      case 'deployed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'deploying':
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Globe className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (deploymentStatus) {
      case 'deployed':
        return 'Live';
      case 'deploying':
        return 'Deploying...';
      case 'failed':
        return 'Failed';
      default:
        return 'Not deployed';
    }
  };

  const getStatusColor = () => {
    switch (deploymentStatus) {
      case 'deployed':
        return 'bg-green-100 text-green-800';
      case 'deploying':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card 
      className={`transition-all duration-200 hover:shadow-md ${isHovered ? 'ring-2 ring-blue-200' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold mb-1">
              {chatbot.name}
            </CardTitle>
            <p className="text-sm text-gray-600 line-clamp-2">
              {chatbot.description}
            </p>
          </div>
          {isFree && (
            <Badge variant="secondary" className="ml-2 text-xs">
              Free
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Deployment Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="text-sm font-medium">{getStatusText()}</span>
            {deploymentStatus === 'deployed' && deploymentUrl && (
              <button
                onClick={() => window.open(deploymentUrl, '_blank')}
                className="text-blue-600 hover:text-blue-800 text-xs underline"
              >
                Visit
              </button>
            )}
          </div>
          <Badge className={`text-xs ${getStatusColor()}`}>
            {deploymentStatus === 'deployed' ? 'LIVE' : deploymentStatus.toUpperCase()}
          </Badge>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-semibold">{chatbot.stats.queries}</div>
            <div className="text-xs text-gray-600">Queries</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{Math.round(chatbot.stats.successRate * 100)}%</div>
            <div className="text-xs text-gray-600">Success</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{chatbot.documents.length}</div>
            <div className="text-xs text-gray-600">Docs</div>
          </div>
        </div>

        {/* Free Tier Usage Warning */}
        {isFree && user.usage.monthlyQueries > 80 && (
          <div className="bg-amber-50 border border-amber-200 p-2 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-amber-800">
                {user.usage.monthlyQueries}/100 queries used this month
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Link href={`/dashboard/chatbots/${chatbot.id}`} className="flex-1">
            <Button variant="outline" className="w-full" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
          </Link>
          
          <Link href={`/dashboard/chatbots/${chatbot.id}/deploy`} className="flex-1">
            <Button 
              className={`w-full ${deploymentStatus === 'deployed' ? 'bg-green-600 hover:bg-green-700' : ''}`}
              size="sm"
            >
              {deploymentStatus === 'deployed' ? (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 mr-2" />
                  Deploy
                </>
              )}
            </Button>
          </Link>
        </div>

        {/* Quick Deploy for Free Users */}
        {isFree && deploymentStatus === 'none' && user.usage.chatbotsCreated < 2 && (
          <div className="border-t pt-3 mt-3">
            <div className="text-xs text-center text-gray-600 mb-2">
              Quick deploy to Vercel (Free plan includes branding)
            </div>
            <Link href={`/dashboard/chatbots/${chatbot.id}/deploy`}>
              <Button variant="outline" className="w-full" size="sm">
                <Crown className="h-4 w-4 mr-2" />
                Deploy Free
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Usage example component for the chatbots list page
interface ChatbotGridProps {
  chatbots: ChatbotConfig[];
  user: UpdatedUserProfile;
  deployments: Record<string, { status: string; url?: string }>;
}

export const ChatbotGrid: React.FC<ChatbotGridProps> = ({
  chatbots,
  user,
  deployments
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {chatbots.map((chatbot) => (
        <ChatbotCardWithDeployment
          key={chatbot.id}
          chatbot={chatbot}
          user={user}
          deploymentStatus={deployments[chatbot.id]?.status as any}
          deploymentUrl={deployments[chatbot.id]?.url}
        />
      ))}
    </div>
  );
};
