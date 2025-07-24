// DEBUG: Example integration of CustomDomainManager into chatbot settings page
// This shows how to integrate the custom domain functionality into your existing chatbot management UI

'use client';

import React, { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Globe, Zap, BarChart, Image } from "lucide-react";

// Import your custom domain components
import CustomDomainManager from '@/components/chatbot/CustomDomainManager';
import { FaviconUploader } from '@/components/FaviconUploader';

interface ChatbotSettingsPageProps {
  params: {
    id: string;
  };
}

interface Chatbot {
  id: string;
  name: string;
  description?: string;
  domain?: string;
  status: 'draft' | 'active' | 'inactive';
  deployment?: {
    vercelProjectId?: string;
    deploymentUrl?: string;
    firebaseProjectId?: string;
    status?: 'deployed' | 'deploying' | 'failed';
  };
  firebaseProject?: {
    projectId?: string;
  };
  appearance?: {
    primaryColor?: string;
    bubbleStyle?: string;
    favicon?: {
      enabled: boolean;
      iconUrl?: string;
      appleTouchIcon?: string;
      manifestIcon192?: string;
      manifestIcon512?: string;
      themeColor?: string;
      backgroundColor?: string;
    };
  };
  createdAt: any;
  updatedAt: any;
}

export default function ChatbotSettingsPage({ params }: ChatbotSettingsPageProps) {
  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time chatbot data subscription
  useEffect(() => {
    if (!params.id) return;

    const chatbotRef = doc(db, 'chatbots', params.id);
    
    const unsubscribe = onSnapshot(
      chatbotRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setChatbot({
            id: docSnap.id,
            ...data
          } as Chatbot);
          setError(null);
        } else {
          setError('Chatbot not found');
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching chatbot:', err);
        setError('Failed to load chatbot data');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [params.id]);

  const handleDomainChange = (newDomain: string) => {
    // Update local state immediately for better UX
    if (chatbot) {
      setChatbot(prev => prev ? { ...prev, domain: newDomain } : null);
    }
  };

  const handleFaviconChange = async (faviconConfig: any) => {
    if (!chatbot) return;

    try {
      // Update local state immediately
      setChatbot(prev => prev ? { 
        ...prev, 
        appearance: { 
          ...prev.appearance, 
          favicon: faviconConfig 
        }
      } : null);

      // Update in Firestore
      const chatbotRef = doc(db, 'chatbots', chatbot.id);
      await updateDoc(chatbotRef, {
        'appearance.favicon': faviconConfig,
        updatedAt: new Date()
      });

    } catch (error) {
      console.error('Error updating favicon:', error);
      // Revert local state on error
      if (chatbot) {
        setChatbot(prev => prev ? { 
          ...prev, 
          appearance: { 
            ...prev.appearance, 
            favicon: chatbot.appearance?.favicon 
          }
        } : null);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: 'secondary',
      active: 'default',
      inactive: 'destructive',
      deployed: 'default',
      deploying: 'secondary',
      failed: 'destructive'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading chatbot settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!chatbot) {
    return <div>Chatbot not found</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{chatbot.name}</h1>
          <p className="text-gray-600 mt-1">
            Configure your chatbot settings and custom domain
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(chatbot.status)}
          {chatbot.deployment?.status && getStatusBadge(chatbot.deployment.status)}
        </div>
      </div>

      {/* Main Settings Tabs */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="domain" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Custom Domain
          </TabsTrigger>
          <TabsTrigger value="deployment" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Deployment
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-4">
          {/* TODO: Update FaviconUploader for settings page */}
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium mb-2">Favicon Settings</h3>
            <p className="text-sm text-gray-500">
              Favicon editing in settings will be available soon. 
              You can set favicon during chatbot creation.
            </p>
          </div>
        </TabsContent>

        {/* Custom Domain Tab - THIS IS THE KEY INTEGRATION */}
        <TabsContent value="domain" className="space-y-4">
          <CustomDomainManager
            chatbotId={chatbot.id}
            chatbotName={chatbot.name}
            currentDomain={chatbot.domain || ''}
            vercelProjectId={chatbot.deployment?.vercelProjectId}
            firebaseProjectId={
              chatbot.deployment?.firebaseProjectId || 
              chatbot.firebaseProject?.projectId
            }
            deploymentUrl={chatbot.deployment?.deploymentUrl}
            onDomainChange={handleDomainChange}
          />
        </TabsContent>

        {/* Other tabs... */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p>General chatbot settings would go here...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deployment Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Deployment settings would go here...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analytics & Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Analytics would go here...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}