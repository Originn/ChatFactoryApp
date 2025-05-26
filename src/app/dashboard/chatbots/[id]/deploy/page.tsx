'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Globe, 
  Settings, 
  BarChart3, 
  Crown,
  Clock,
  ArrowLeft
} from 'lucide-react';
import { FreeTierDeploymentCard } from '@/components/deployment/FreeTierDeploymentCard';
import { UsageWarningBanner, DeploymentSuccessCard } from '@/components/deployment/UsageBanners';
import { DeploymentService } from '@/services/deploymentService';
import { ChatbotConfig } from '@/types/chatbot';
import { DeploymentRecord } from '@/types/deployment';
import Link from 'next/link';

interface DeploymentPageProps {
  params: { id: string };
}

export default function DeploymentPage({ params }: DeploymentPageProps) {
  const { user, userProfile } = useAuth();
  const [chatbot, setChatbot] = useState<ChatbotConfig | null>(null);
  const [deployment, setDeployment] = useState<DeploymentRecord | null>(null);
  const [deploymentStatus, setDeploymentStatus] = useState<'none' | 'deploying' | 'deployed' | 'failed'>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadChatbotAndDeployment();
    }
  }, [params.id, user]);

  const loadChatbotAndDeployment = async () => {
    try {
      setLoading(true);
      
      // In a real implementation, you'd fetch from your chatbot service
      // For now, using mock data
      const mockChatbot: ChatbotConfig = {
        id: params.id,
        userId: user?.uid || '',
        name: 'Customer Support Bot',
        description: 'AI assistant for customer inquiries',
        domain: 'support.example.com',
        requireAuth: false,
        status: 'active',
        documents: [],
        aiConfig: {
          embeddingModel: 'text-embedding-ada-002',
          llmModel: 'gpt-3.5-turbo',
          temperature: 0.7,
          contextWindow: 4000
        },
        behavior: {
          persona: 'helpful assistant',
          responseLength: 'medium',
          systemPrompt: 'You are a helpful customer support assistant.'
        },
        appearance: {
          primaryColor: '#3b82f6',
          bubbleStyle: 'modern'
        },
        stats: {
          queries: 0,
          successRate: 0,
          lastUpdated: new Date() as any
        },
        createdAt: new Date() as any,
        updatedAt: new Date() as any
      };

      setChatbot(mockChatbot);

      // Check if deployment exists
      const userDeployments = await DeploymentService.getUserDeployments(user?.uid || '');
      const existingDeployment = userDeployments.find(d => d.chatbotId === params.id && d.status !== 'deleted');
      
      if (existingDeployment) {
        setDeployment(existingDeployment);
        setDeploymentStatus(existingDeployment.status === 'deployed' ? 'deployed' : existingDeployment.status as any);
      }

    } catch (error) {
      console.error('Failed to load chatbot and deployment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!chatbot || !userProfile) return;
    
    setDeploymentStatus('deploying');
    
    try {
      const result = await DeploymentService.deployToVercel({
        chatbot,
        user: userProfile as any
      });
      
      if (result.success) {
        setDeploymentStatus('deployed');
        // Reload deployment data
        await loadChatbotAndDeployment();
      } else {
        setDeploymentStatus('failed');
        console.error('Deployment failed:', result.error);
      }
    } catch (error) {
      setDeploymentStatus('failed');
      console.error('Deployment error:', error);
    }
  };

  const handleUpgrade = () => {
    // Navigate to billing/upgrade page
    window.location.href = '/dashboard/settings/billing';
  };

  const handleCopyUrl = async () => {
    if (deployment?.deploymentUrl) {
      await navigator.clipboard.writeText(deployment.deploymentUrl);
      // You could add a toast notification here
    }
  };

  const handleRedeploy = async () => {
    setDeploymentStatus('deploying');
    // In a real implementation, trigger redeployment
    setTimeout(() => {
      setDeploymentStatus('deployed');
    }, 3000);
  };

  const handleDeleteDeployment = async () => {
    if (deployment && window.confirm('Are you sure you want to delete this deployment?')) {
      const result = await DeploymentService.deleteDeployment(deployment.id);
      if (result.success) {
        setDeployment(null);
        setDeploymentStatus('none');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Clock className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!chatbot) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Chatbot not found</h2>
        <p className="text-gray-600 mt-2">The chatbot you're looking for doesn't exist.</p>
        <Link href="/dashboard/chatbots">
          <Button className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Chatbots
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href={`/dashboard/chatbots/${params.id}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Deploy {chatbot.name}</h1>
            <p className="text-gray-600 mt-1">Make your chatbot live on the web</p>
          </div>
        </div>
        {userProfile?.subscription.plan === 'free' && (
          <Badge variant="secondary" className="bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700">
            <Crown className="h-3 w-3 mr-1" />
            Free Plan
          </Badge>
        )}
      </div>

      {/* Usage Warning */}
      {userProfile && (
        <UsageWarningBanner 
          user={userProfile as any} 
          onUpgrade={handleUpgrade} 
        />
      )}

      <Tabs defaultValue="deploy" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="deploy" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Deploy
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Deploy Tab */}
        <TabsContent value="deploy" className="space-y-6">
          {deploymentStatus === 'none' && userProfile && (
            <FreeTierDeploymentCard
              user={userProfile as any}
              chatbot={chatbot}
              onDeploy={handleDeploy}
              onUpgrade={handleUpgrade}
            />
          )}

          {deploymentStatus === 'deployed' && deployment && (
            <DeploymentSuccessCard
              deploymentUrl={deployment.deploymentUrl || ''}
              isFreePlan={userProfile?.subscription.plan === 'free'}
              onUpgrade={handleUpgrade}
              onRedeploy={handleRedeploy}
              onDelete={handleDeleteDeployment}
              onCopyUrl={handleCopyUrl}
            />
          )}

          {deploymentStatus === 'failed' && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-6 text-center">
                <div className="text-red-600 mb-4">
                  <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                    <Globe className="h-6 w-6" />
                  </div>
                </div>
                <h3 className="text-lg font-medium text-red-800 mb-2">
                  Deployment Failed
                </h3>
                <p className="text-red-700 text-sm mb-4">
                  Something went wrong during deployment. Please try again.
                </p>
                <Button
                  onClick={() => setDeploymentStatus('none')}
                  variant="outline"
                >
                  Try Again
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Deployment Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {userProfile?.subscription.plan === 'free' ? (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Free Plan Limitations</h3>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Vercel subdomain only</li>
                    <li>• ChatFactory branding included</li>
                    <li>• 100 queries per month</li>
                    <li>• 7-day analytics retention</li>
                    <li>• Community support</li>
                  </ul>
                  <Button 
                    className="mt-3" 
                    size="sm"
                    onClick={handleUpgrade}
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade for More Features
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600">
                    Advanced deployment settings available for Pro users.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Deployment Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              {userProfile?.subscription.plan === 'free' ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="font-medium mb-2">Limited Analytics</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Free plan includes basic analytics for the last 7 days.
                  </p>
                  <Button onClick={handleUpgrade}>
                    <Crown className="h-4 w-4 mr-2" />
                    Upgrade for Advanced Analytics
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600">
                    Advanced analytics dashboard for Pro users.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
