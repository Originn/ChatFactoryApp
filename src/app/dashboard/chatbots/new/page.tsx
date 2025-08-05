'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";
import UserDropdown from "@/components/dashboard/UserDropdown";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { uploadLogo, validateLogoFile } from "@/lib/utils/logoUpload";
import { uploadFavicon } from "@/lib/utils/faviconUpload";
import { Info, Brain, Bot, Palette } from "lucide-react";
import { VectorStoreNameDialog } from '@/components/dialogs/VectorStoreNameDialog';
import { FaviconUploader } from '@/components/FaviconUploader';

export default function NewChatbotPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    // Basic Info
    name: '',
    description: '',
    requireAuth: false, // New: Authentication requirement
    accessMode: 'open' as 'open' | 'managed', // Access control mode
    invitedUsers: [] as string[], // Email addresses to invite
    
    // AI Configuration
    embeddingModel: 'text-embedding-3-small',
    multimodal: false,
    llmModel: 'gpt-4.1',
    temperature: '0.7',
    contextWindow: '4096',
    
    // Behavior
    persona: 'helpful',
    responseLength: 'balanced',
    systemPrompt: 'You are a helpful AI assistant for answering questions about our documentation. Use the provided context to answer the user\'s questions accurately. If you don\'t know the answer or if it\'s not in the provided documentation, say so clearly rather than making up information.',
    
    // Appearance
    primaryColor: '#3b82f6', // Blue
    bubbleStyle: 'rounded',
    favicon: {
      enabled: false,
      themeColor: '#000000',
      backgroundColor: '#ffffff',
    },
  });
  
  const [activeTab, setActiveTab] = useState<'basic' | 'ai' | 'behavior' | 'appearance'>('basic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Logo upload state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Favicon upload state
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [faviconError, setFaviconError] = useState<string | null>(null);
  const [faviconUploading, setFaviconUploading] = useState(false);

  // Preview deployment
  const [newChatbotId, setNewChatbotId] = useState<string | null>(null);
  const [showVectorDialog, setShowVectorDialog] = useState(false);
  const [isDeployingPreview, setIsDeployingPreview] = useState(false);
  
  // Global deployment state
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState<string>('');
  const [deploymentStep, setDeploymentStep] = useState<number>(0);
  const [totalSteps] = useState<number>(5);

  // Email management for invited users
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  // Email validation function
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Auto-enable multimodal when multimodal embedding model is selected
  useEffect(() => {
    const multimodalModels = ['jina-embeddings-v4', 'jina-clip-v2'];
    if (multimodalModels.includes(formData.embeddingModel)) {
      // Auto-enable multimodal for multimodal-capable models
      setFormData(prev => ({ ...prev, multimodal: true }));
    } else {
      // Auto-disable multimodal for text-only models
      setFormData(prev => ({ ...prev, multimodal: false }));
    }
  }, [formData.embeddingModel]);

  // Prevent navigation during deployment
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDeploying) {
        e.preventDefault();
        e.returnValue = 'Your chatbot is currently being deployed. Are you sure you want to leave?';
        return 'Your chatbot is currently being deployed. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDeploying]);

  // Add email to invited users
  const addEmailToInvited = () => {
    const email = newEmail.trim().toLowerCase();
    
    if (!email) {
      setEmailError('Please enter an email address');
      return;
    }
    
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    if (formData.invitedUsers.includes(email)) {
      setEmailError('This email is already added');
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      invitedUsers: [...prev.invitedUsers, email]
    }));
    
    setNewEmail('');
    setEmailError('');
  };

  // Remove email from invited users
  const removeEmailFromInvited = (email: string) => {
    setFormData(prev => ({
      ...prev,
      invitedUsers: prev.invitedUsers.filter(e => e !== email)
    }));
  };

  // Handle Enter key in email input
  const handleEmailKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmailToInvited();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  // Handle switch/boolean changes
  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  // Handle favicon config changes (colors, enabled state)
  const handleFaviconConfigChange = (faviconConfig: any) => {
    setFormData(prev => ({
      ...prev,
      favicon: faviconConfig
    }));
  };

  // Handle favicon file selection
  const handleFaviconChange = (file: File | null) => {
    if (!file) {
      setFaviconFile(null);
      setFaviconPreview(null);
      setFaviconError(null);
      return;
    }

    // Validate the file
    if (!['image/png', 'image/x-icon', 'image/svg+xml'].includes(file.type)) {
      setFaviconError('Please upload a PNG, ICO, or SVG file');
      setFaviconFile(null);
      setFaviconPreview(null);
      return;
    }

    if (file.size > 1024 * 1024) {
      setFaviconError('File size must be less than 1MB');
      setFaviconFile(null);
      setFaviconPreview(null);
      return;
    }

    setFaviconFile(file);
    setFaviconError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setFaviconPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle logo file selection
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      setLogoError(null);
      return;
    }

    // Validate the file
    const validation = validateLogoFile(file);
    if (!validation.isValid) {
      setLogoError(validation.error || 'Invalid file');
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }

    setLogoFile(file);
    setLogoError(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setLogoPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Remove logo
  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoError(null);
    // Reset the file input
    const fileInput = document.getElementById('logoUpload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const deployChatbot = async (indexName: string, displayName: string) => {
    if (!user || !newChatbotId) return;

    setIsDeploying(true);
    setIsDeployingPreview(true);
    setDeploymentStep(1);
    setDeploymentProgress('Preparing deployment...');
    
    try {
      setDeploymentStep(2);
      setDeploymentProgress('Creating project infrastructure...');
      
      const response = await fetch('/api/vercel-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatbotId: newChatbotId,
          chatbotName: formData.name.trim(),
          userId: user.uid,
          vectorstore: { indexName, displayName },
          embeddingModel: formData.embeddingModel,
          target: 'production',
        }),
      });

      setDeploymentStep(3);
      setDeploymentProgress('Configuring Firebase and authentication...');

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to deploy chatbot');
      }

      setDeploymentStep(4);
      setDeploymentProgress('Finalizing chatbot configuration...');

      await updateDoc(doc(db, 'chatbots', newChatbotId), {
        status: 'deployed',
        deployedUrl: data.url,
        vercelProjectId: data.projectName,
        vercelDeploymentId: data.deploymentId,
        vectorstore: {
          indexName,
          displayName,
          provider: 'pinecone',
          status: 'ready',
        },
        updatedAt: serverTimestamp(),
      });

      setDeploymentStep(5);
      setDeploymentProgress('Deployment complete! Redirecting...');
      
      // Small delay to show completion message
      setTimeout(() => {
        router.push(`/dashboard/chatbots/${newChatbotId}`);
      }, 1000);
    } catch (err: any) {
      console.error('Error deploying chatbot:', err);
      setError(err.message || 'Failed to deploy chatbot');
      setDeploymentProgress('Deployment failed');
    } finally {
      setIsDeploying(false);
      setIsDeployingPreview(false);
    }
  };

  const deployChatbotWithNewVectorStore = async (displayName: string, desiredIndexName?: string, embeddingModel?: string) => {
    if (!user || !newChatbotId) return;

    setIsDeploying(true);
    setIsDeployingPreview(true);
    setDeploymentStep(1);
    setDeploymentProgress('Preparing deployment with new knowledge base...');
    
    try {
      setDeploymentStep(2);
      setDeploymentProgress('Creating vectorstore and project infrastructure...');
      
      const response = await fetch('/api/vercel-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatbotId: newChatbotId,
          chatbotName: formData.name.trim(),
          userId: user.uid,
          vectorstore: null,
          desiredVectorstoreIndexName: desiredIndexName,
          embeddingModel: embeddingModel,
          target: 'production',
        }),
      });

      setDeploymentStep(3);
      setDeploymentProgress('Configuring Firebase and authentication...');

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to deploy chatbot');
      }

      setDeploymentStep(4);
      setDeploymentProgress('Finalizing chatbot and knowledge base...');

      await updateDoc(doc(db, 'chatbots', newChatbotId), {
        status: 'deployed',
        deployedUrl: data.url,
        vercelProjectId: data.projectName,
        vercelDeploymentId: data.deploymentId,
        vectorstore: {
          indexName: data.vectorstoreIndexName || 'unknown',
          displayName: displayName,
          provider: 'pinecone',
          status: 'ready',
        },
        updatedAt: serverTimestamp(),
      });

      setDeploymentStep(5);
      setDeploymentProgress('Deployment complete! Redirecting...');
      
      // Small delay to show completion message
      setTimeout(() => {
        router.push(`/dashboard/chatbots/${newChatbotId}`);
      }, 1000);
    } catch (err: any) {
      console.error('Error deploying with new vectorstore:', err);
      setError(err.message || 'Failed to deploy with new vectorstore');
      setDeploymentProgress('Deployment failed');
    } finally {
      setIsDeploying(false);
      setIsDeployingPreview(false);
    }
  };

  const handleConfirmVectorstore = async (displayName: string, indexName: string, isExisting: boolean, embeddingModel: string) => {
    setShowVectorDialog(false);
    try {
      if (isExisting) {
        // Use existing vector store - pass vectorstore object to deployment
        console.log('🔄 Using existing vector store:', displayName, '(' + indexName + ')');
        deployChatbot(indexName, displayName);
      } else {
        // Create new vector store - pass the desired index name to deployment script
        console.log('🆕 Creating new vector store via deployment script:', displayName, '-> desired index name:', indexName, '-> embedding model:', embeddingModel);
        deployChatbotWithNewVectorStore(displayName, indexName, embeddingModel);
      }
    } catch (err: any) {
      console.error('Vectorstore handling failed:', err);
      setError(err.message || 'Failed to handle vectorstore');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!user) {
      setError('You must be logged in to create a chatbot');
      setLoading(false);
      return;
    }

    if (!formData.name.trim()) {
      setError('Chatbot name is required');
      setLoading(false);
      return;
    }

    try {
      // Generate a new document ID
      const chatbotsCollectionRef = collection(db, 'chatbots');
      const newChatbotRef = doc(chatbotsCollectionRef);
      
      let logoUrl: string | null = null;
      let faviconUrls: any = null;

      // Upload logo if one was selected
      if (logoFile) {
        try {
          setLogoUploading(true);
          logoUrl = await uploadLogo(logoFile, user.uid, newChatbotRef.id);
          console.log('Logo uploaded successfully:', logoUrl);
        } catch (uploadError: any) {
          console.error('Logo upload failed:', uploadError);
          
          // For CORS errors, allow creation without logo but warn user
          if (uploadError.message?.includes('CORS') || uploadError.message?.includes('blocked')) {
            console.warn('CORS issue detected, creating chatbot without logo');
            setError('Logo upload failed due to CORS policy, but chatbot will be created without logo. Please configure CORS settings in Firebase Storage.');
            logoUrl = null; // Proceed without logo
          } else {
            // For other errors, stop the creation process
            setError(`Failed to upload logo: ${uploadError.message}`);
            setLoading(false);
            setLogoUploading(false);
            return;
          }
        } finally {
          setLogoUploading(false);
        }
      }

      // Upload favicon if one was selected  
      if (faviconFile && formData.favicon.enabled) {
        try {
          setFaviconUploading(true);
          faviconUrls = await uploadFavicon(faviconFile, user.uid, newChatbotRef.id);
          console.log('Favicon uploaded successfully:', faviconUrls);
        } catch (uploadError: any) {
          console.error('Favicon upload failed:', uploadError);
          setError(`Failed to upload favicon: ${uploadError.message}`);
          setLoading(false);
          setFaviconUploading(false);
          return;
        } finally {
          setFaviconUploading(false);
        }
      }
      
      // Prepare data for Firestore
      const chatbotData: any = {
        id: newChatbotRef.id,
        userId: user.uid,
        name: formData.name.trim(),
        description: formData.description.trim(),
        requireAuth: formData.requireAuth, // Authentication requirement setting
        logoUrl: logoUrl, // Add logo URL to the data
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'draft',
        documents: [],
        aiConfig: {
          embeddingModel: formData.embeddingModel,
          multimodal: formData.multimodal,
          llmModel: formData.llmModel,
          temperature: parseFloat(formData.temperature),
          contextWindow: parseInt(formData.contextWindow),
        },
        behavior: {
          persona: formData.persona,
          responseLength: formData.responseLength,
          systemPrompt: formData.systemPrompt,
        },
        appearance: {
          primaryColor: formData.primaryColor,
          bubbleStyle: formData.bubbleStyle,
          favicon: {
            enabled: formData.favicon.enabled,
            iconUrl: faviconUrls?.icon32 || null,
            appleTouchIcon: faviconUrls?.appleTouchIcon || null,
            manifestIcon192: faviconUrls?.icon192 || null,
            manifestIcon512: faviconUrls?.icon512 || null,
            themeColor: formData.favicon.themeColor,
            backgroundColor: formData.favicon.backgroundColor,
          },
        },
        stats: {
          queries: 0,
          successRate: 0,
          lastUpdated: serverTimestamp(),
        }
      };

      // Only add authConfig if authentication is required
      if (formData.requireAuth) {
        chatbotData.authConfig = {
          accessMode: formData.accessMode,
          allowSignup: formData.accessMode === 'open', // backward compatibility
          requireEmailVerification: true,
          allowGoogleAuth: true,
          allowAnonymousUsers: false,
          sessionTimeout: 60, // minutes
          maxConcurrentSessions: 1,
          invitedUsers: formData.accessMode === 'managed' ? formData.invitedUsers : [], // Use actual invited users
        };
      }
      
      // Save to Firestore
      await setDoc(newChatbotRef, chatbotData);
      
      // Show success message using local storage (will be displayed on the next page)
      localStorage.setItem('chatbotCreated', 'true');
      localStorage.setItem('chatbotName', formData.name.trim());
      
      // Clear any error from logo upload if chatbot was created successfully
      if (logoUrl === null && logoFile) {
        // Show success but mention logo issue
        console.log('Chatbot created successfully, but without logo due to upload issue');
      }
      
      setNewChatbotId(newChatbotRef.id);
      setShowVectorDialog(true);
   } catch (err: any) {
      console.error('Error creating chatbot:', err);
      setError(err.message || 'Failed to create chatbot. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Deployment Progress Overlay
  const renderDeploymentOverlay = () => {
    if (!isDeploying) return null;

    return (
      <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
        <div className="bg-card rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl border border-border">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white" />
            </div>
            
            <h3 className="text-xl font-bold text-foreground mb-2">Deploying Your Chatbot</h3>
            <p className="text-muted-foreground mb-6">Please wait while we set up your AI assistant...</p>
            
            {/* Progress Bar */}
            <div className="w-full bg-muted rounded-full h-2 mb-4">
              <div 
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(deploymentStep / totalSteps) * 100}%` }}
              />
            </div>
            
            {/* Progress Steps */}
            <div className="text-sm text-muted-foreground mb-4">
              Step {deploymentStep} of {totalSteps}
            </div>
            
            {/* Current Step Description */}
            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              {deploymentProgress}
            </p>
            
            {/* Progress Steps List */}
            <div className="mt-6 text-left">
              <div className="space-y-2">
                {[
                  'Preparing deployment',
                  'Creating infrastructure', 
                  'Configuring authentication',
                  'Finalizing setup',
                  'Deployment complete'
                ].map((step, index) => (
                  <div key={index} className="flex items-center text-sm">
                    <div className={`w-4 h-4 rounded-full mr-3 flex items-center justify-center ${
                      index + 1 < deploymentStep 
                        ? 'bg-green-500 text-white' 
                        : index + 1 === deploymentStep 
                          ? 'bg-blue-500 text-white animate-pulse' 
                          : 'bg-gray-200 text-gray-400'
                    }`}>
                      {index + 1 < deploymentStep ? '✓' : index + 1}
                    </div>
                    <span className={
                      index + 1 < deploymentStep 
                        ? 'text-green-600 dark:text-green-400 font-medium' 
                        : index + 1 === deploymentStep 
                          ? 'text-blue-600 dark:text-blue-400 font-medium' 
                          : 'text-muted-foreground'
                    }>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                ⚡ This usually takes 2-3 minutes. Please keep this page open.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background dark:from-background dark:via-muted/20 dark:to-background relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" />
      <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{ animationDelay: '2s' }} />
      
      {/* Dashboard Header */}
      <header className="relative z-50 backdrop-blur-sm bg-background/70 border-b border-border/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <div className="flex items-center space-x-3">
                  <img src="/logo.png" alt="WizeChat" className="h-8 w-8" />
                  <span className="font-bold text-xl text-gradient">WizeChat</span>
                </div>
              </div>
              <nav className="hidden sm:ml-8 sm:flex sm:space-x-8">
                <Link
                  href="/dashboard"
                  className="border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/chatbots"
                  className="border-purple-500 text-foreground inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Chatbots
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors"
                >
                  Settings
                </Link>
              </nav>
            </div>
            <div className="flex items-center">
              <UserDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* New Chatbot Form */}
      <main className="relative max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                <div className="h-6 w-6 text-white">✨</div>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Create New Chatbot</h1>
                <p className="text-muted-foreground mt-1">Build your AI assistant in just a few steps</p>
              </div>
            </div>
            <Button
              asChild
              variant="outline"
              className="border-border hover:bg-muted/50"
            >
              <Link href="/dashboard/chatbots">
                Cancel
              </Link>
            </Button>
          </div>
        </div>

        <Card variant="elevated" className="mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader>
            <CardTitle className="text-2xl flex items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center mr-3">
                <div className="h-4 w-4 text-white">🤖</div>
              </div>
              Create Your Chatbot
            </CardTitle>
            <CardDescription className="text-base">
              Configure your chatbot's settings to best suit your documentation and user needs. Follow the tabs below to customize every aspect of your AI assistant.
            </CardDescription>
          </CardHeader>
          
          {/* Tab Navigation */}
          <div className="px-6 border-b border-border">
            <nav className="-mb-px flex space-x-6">
              <button
                onClick={() => setActiveTab('basic')}
                className={`${
                  activeTab === 'basic'
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/50 hover:bg-muted/50'
                } whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm rounded-t-lg transition-all flex items-center`}
              >
                <Info className="w-4 h-4 mr-2" />
                Basic Info
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`${
                  activeTab === 'ai'
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/50 hover:bg-muted/50'
                } whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm rounded-t-lg transition-all flex items-center`}
              >
                <Brain className="w-4 h-4 mr-2" />
                AI Configuration
              </button>
              <button
                onClick={() => setActiveTab('behavior')}
                className={`${
                  activeTab === 'behavior'
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/50 hover:bg-muted/50'
                } whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm rounded-t-lg transition-all flex items-center`}
              >
                <Bot className="w-4 h-4 mr-2" />
                Behavior
              </button>
              <button
                onClick={() => setActiveTab('appearance')}
                className={`${
                  activeTab === 'appearance'
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/50 hover:bg-muted/50'
                } whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm rounded-t-lg transition-all flex items-center`}
              >
                <Palette className="w-4 h-4 mr-2" />
                Appearance
              </button>
            </nav>
          </div>
          
          <CardContent className="pt-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium text-foreground">Chatbot Name *</label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g., Product Documentation Assistant"
                      required
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Choose a clear, descriptive name for your chatbot.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-medium text-foreground">Description</label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Describe what this chatbot will help users with..."
                      rows={3}
                      className="flex h-auto w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <p className="text-xs text-muted-foreground">
                      Provide details about what kind of questions this chatbot will answer.
                    </p>
                  </div>
                  
                  {/* Custom Domain Info */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                    <div className="flex items-start space-x-2">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200">Custom Domain</h4>
                        <p className="text-sm text-blue-800 dark:text-blue-100 mt-1 font-medium">
                          After creating your chatbot, you can configure a custom domain (like chat.yourcompany.com) 
                          in the chatbot settings. We'll provide DNS instructions and handle the technical setup automatically.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Authentication Option */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <label htmlFor="requireAuth" className="text-sm font-medium text-foreground">
                          Require User Authentication
                        </label>
                        <div className="relative group">
                          <Info className="h-4 w-4 text-gray-400 cursor-help" />
                          <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 w-80 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            <div className="space-y-2">
                              <p className="font-medium">Authentication Options:</p>
                              <div className="space-y-1">
                                <p><strong>✅ With Authentication:</strong></p>
                                <ul className="list-disc list-inside space-y-1 ml-2 text-gray-300">
                                  <li>Users must sign up/login to use chatbot</li>
                                  <li>Persistent chat history per user</li>
                                  <li>User analytics and engagement tracking</li>
                                  <li>Personalized responses based on user data</li>
                                  <li>Better abuse prevention</li>
                                </ul>
                                <p className="mt-2"><strong>❌ Without Authentication:</strong></p>
                                <ul className="list-disc list-inside space-y-1 ml-2 text-gray-300">
                                  <li>Instant access - no signup required</li>
                                  <li>Anonymous usage (no chat history)</li>
                                  <li>Easier for simple support/FAQ bots</li>
                                  <li>Lower user friction</li>
                                </ul>
                              </div>
                            </div>
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                      <Switch
                        id="requireAuth"
                        checked={formData.requireAuth}
                        onCheckedChange={(checked) => handleSwitchChange('requireAuth', checked)}
                      />
                    </div>
                    
                    {/* Access Control Options - Only shown when authentication is enabled */}
                    {formData.requireAuth && (
                      <div className="space-y-4 pl-4 border-l-2 border-blue-200">
                        <h4 className="text-sm font-medium text-foreground">Access Control</h4>
                        
                        <div className="space-y-3">
                          <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="radio"
                              name="accessMode"
                              value="open"
                              checked={formData.accessMode === 'open'}
                              onChange={(e) => setFormData(prev => ({ ...prev, accessMode: e.target.value as 'open' | 'managed' }))}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <div>
                              <div className="text-sm font-medium text-foreground">Open Signup</div>
                              <div className="text-sm text-muted-foreground">Allow anyone to create an account and use the chatbot</div>
                            </div>
                          </label>
                          
                          <label className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="radio"
                              name="accessMode"
                              value="managed"
                              checked={formData.accessMode === 'managed'}
                              onChange={(e) => setFormData(prev => ({ ...prev, accessMode: e.target.value as 'open' | 'managed' }))}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                            />
                            <div>
                              <div className="text-sm font-medium text-foreground">Admin-Managed Users</div>
                              <div className="text-sm text-muted-foreground">Only users you invite can access the chatbot</div>
                            </div>
                          </label>
                        </div>
                        
                        {/* User Invitation Interface - Only shown when managed mode is selected */}
                        {formData.accessMode === 'managed' && (
                          <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                            <h5 className="text-sm font-medium text-gray-900">Invite Users</h5>
                            <p className="text-xs text-gray-600">
                              Add email addresses of users you want to invite. They'll receive login instructions after deployment.
                            </p>
                            
                            {/* Add Email Input */}
                            <div className="flex space-x-2">
                              <Input
                                type="email"
                                placeholder="Enter email address"
                                value={newEmail}
                                onChange={(e) => {
                                  setNewEmail(e.target.value);
                                  setEmailError('');
                                }}
                                onKeyPress={handleEmailKeyPress}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                onClick={addEmailToInvited}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                Add
                              </Button>
                            </div>
                            
                            {emailError && (
                              <p className="text-sm text-red-600">{emailError}</p>
                            )}
                            
                            {/* Display Invited Emails */}
                            {formData.invitedUsers.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-sm text-gray-700">{formData.invitedUsers.length} user(s) to be invited:</p>
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                  {formData.invitedUsers.map((email, index) => (
                                    <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded border text-sm">
                                      <span className="text-gray-900">{email}</span>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => removeEmailFromInvited(email)}
                                        className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                                      >
                                        ×
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {formData.invitedUsers.length === 0 && (
                              <p className="text-sm text-gray-500 italic">
                                Add email addresses above. You can also invite users after deployment.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className={`transition-all duration-200 ${formData.requireAuth ? 'opacity-100' : 'opacity-60'}`}>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start space-x-2">
                          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-blue-900">
                              {formData.requireAuth ? 'Authentication Enabled' : 'Authentication Disabled'}
                            </h4>
                            {formData.requireAuth ? (
                              <div className="text-sm text-blue-800 space-y-1">
                                <p>Your chatbot will require users to:</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                  <li>Create an account or sign in</li>
                                  <li>Verify their email address</li>
                                  <li>Accept terms of service</li>
                                  {formData.accessMode === 'managed' && (
                                    <li className="font-medium">Be invited by you first</li>
                                  )}
                                </ul>
                                <p className="mt-2 font-medium">
                                  Access Mode: {formData.accessMode === 'open' ? 'Open Signup' : 'Admin-Managed Users'}
                                </p>
                                {formData.accessMode === 'managed' && formData.invitedUsers.length > 0 && (
                                  <p className="text-sm">
                                    {formData.invitedUsers.length} user(s) will be invited after deployment
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-blue-800 space-y-1">
                                <p>Your chatbot will allow anonymous access:</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                  <li>No signup required - instant usage</li>
                                  <li>Simpler for basic support/FAQ bots</li>
                                  <li>Lower barrier to entry</li>
                                  <li>No chat history or personalization</li>
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* AI Configuration Tab */}
              {activeTab === 'ai' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="embeddingModel" className="text-sm font-medium">Embedding Model *</label>
                    <select
                      id="embeddingModel"
                      name="embeddingModel"
                      value={formData.embeddingModel}
                      onChange={handleChange}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <optgroup label="OpenAI Models">
                        <option value="text-embedding-3-small">text-embedding-3-small (1536 dimensions)</option>
                        <option value="text-embedding-3-large">text-embedding-3-large (3072 dimensions)</option>
                        <option value="text-embedding-ada-002">text-embedding-ada-002 (Legacy)</option>
                      </optgroup>
                      <optgroup label="Azure OpenAI Models">
                        <option value="azure-text-embedding-3-small">Azure text-embedding-3-small</option>
                        <option value="azure-text-embedding-3-large">Azure text-embedding-3-large</option>
                      </optgroup>
                      <optgroup label="Cohere Models">
                        <option value="cohere-embed-english-v3.0">embed-english-v3.0</option>
                        <option value="cohere-embed-multilingual-v3.0">embed-multilingual-v3.0</option>
                      </optgroup>
                      <optgroup label="Hugging Face Models">
                        <option value="hf-all-MiniLM-L6-v2">all-MiniLM-L6-v2</option>
                        <option value="hf-all-mpnet-base-v2">all-mpnet-base-v2</option>
                        <option value="hf-bge-large-en-v1.5">bge-large-en-v1.5</option>
                      </optgroup>
                      <optgroup label="Jina AI Models">
                        <option value="jina-embeddings-v4">jina-embeddings-v4 (512 dimensions, multimodal)</option>
                        <option value="jina-embeddings-v3">jina-embeddings-v3 (1024 dimensions, text-only)</option>
                        <option value="jina-clip-v2">jina-clip-v2 (1024 dimensions, multimodal)</option>
                      </optgroup>
                    </select>
                    <p className="text-xs text-gray-500">
                      Choose which embedding model to use for document vectorization.
                    </p>
                  </div>
                  
                  {/* Multimodal Toggle */}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="multimodal"
                        name="multimodal"
                        checked={formData.multimodal}
                        onChange={handleChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        disabled={!['jina-embeddings-v4', 'jina-clip-v2'].includes(formData.embeddingModel)}
                      />
                      <label htmlFor="multimodal" className="text-sm font-medium">
                        Enable Multimodal Processing
                      </label>
                      <div className="relative group">
                        <svg className="w-4 h-4 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 hidden group-hover:block bg-black text-white text-xs rounded py-1 px-2 whitespace-nowrap z-50">
                          Process both text and images from documents (requires jina-embeddings-v4 or jina-clip-v2)
                        </div>
                      </div>
                    </div>
                    {formData.multimodal && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                        <p className="text-blue-800">
                          <strong>Multimodal Mode:</strong> Your chatbot will process both text and images from documents. 
                          Great for PDFs with charts, diagrams, and visual content.
                        </p>
                      </div>
                    )}
                    {!['jina-embeddings-v4', 'jina-clip-v2'].includes(formData.embeddingModel) && (
                      <p className="text-xs text-orange-600">
                        Multimodal processing requires jina-embeddings-v4 or jina-clip-v2 models.
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="llmModel" className="text-sm font-medium">LLM Model *</label>
                    <select
                      id="llmModel"
                      name="llmModel"
                      value={formData.llmModel}
                      onChange={handleChange}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <optgroup label="OpenAI Models">
                        <option value="gpt-4.1">GPT-4.1 (Latest API model)</option>
                        <option value="gpt-4.1-mini">GPT-4.1 Mini (Balanced)</option>
                        <option value="gpt-4.1-nano">GPT-4.1 Nano (Fast)</option>
                        <option value="gpt-4-vision-preview">GPT-4 Vision (Image handling)</option>
                      </optgroup>
                      <optgroup label="Anthropic Claude Models">
                        <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet (API version)</option>
                        <option value="claude-3-5-sonnet-20240520">Claude 3.5 Sonnet (Vision)</option>
                        <option value="claude-3-opus-20240229">Claude 3 Opus (High capability)</option>
                        <option value="claude-3-haiku-20240307">Claude 3 Haiku (Fast)</option>
                      </optgroup>
                      <optgroup label="Google Gemini Models">
                        <option value="gemini-2.5-pro-001">Gemini 2.5 Pro (Thinking, 2025)</option>
                        <option value="gemini-2.5-flash-001">Gemini 2.5 Flash (Fast thinking)</option>
                        <option value="gemini-1.5-pro-002">Gemini 1.5 Pro (1M context)</option>
                        <option value="gemini-1.5-flash-002">Gemini 1.5 Flash (Fast)</option>
                      </optgroup>
                      <optgroup label="Mistral AI Models">
                        <option value="mistral-medium-3-2505">Mistral Medium 3 (May 2025)</option>
                        <option value="mistral-small-3.1-2503">Mistral Small 3.1 (March 2025)</option>
                        <option value="mistral-large-2407">Mistral Large 2 (2024 version)</option>
                        <option value="codestral-2405">Codestral (Latest code model)</option>
                      </optgroup>
                      <optgroup label="DeepSeek Models">
                        <option value="deepseek-v3-0324">DeepSeek V3-0324 (March 2025)</option>
                        <option value="deepseek-chat">DeepSeek Chat (V3 API)</option>
                        <option value="deepseek-reasoner">DeepSeek Reasoner (R1 API)</option>
                      </optgroup>
                      <optgroup label="Meta Models">
                        <option value="meta-llama/Llama-3.1-405B">Llama 3.1 405B (Full API model)</option>
                        <option value="meta-llama/Llama-3.1-70B">Llama 3.1 70B (Balanced)</option>
                        <option value="meta-llama/Llama-3.3-8B">Llama 3.3 8B (Latest version)</option>
                      </optgroup>
                    </select>
                    <p className="text-xs text-gray-500">
                      Select which language model will generate responses for your chatbot.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="temperature" className="text-sm font-medium">Response Creativity</label>
                      <select
                        id="temperature"
                        name="temperature"
                        value={formData.temperature}
                        onChange={handleChange}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="0.2">Low (More Precise)</option>
                        <option value="0.7">Medium (Balanced)</option>
                        <option value="1.0">High (More Creative)</option>
                      </select>
                      <p className="text-xs text-gray-500">
                        Controls the creativity and randomness of responses.
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="contextWindow" className="text-sm font-medium">Context Window</label>
                      <select
                        id="contextWindow"
                        name="contextWindow"
                        value={formData.contextWindow}
                        onChange={handleChange}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="2048">2K tokens (Smaller)</option>
                        <option value="4096">4K tokens (Standard)</option>
                        <option value="8192">8K tokens (Larger)</option>
                        <option value="16384">16K tokens (Maximum)</option>
                      </select>
                      <p className="text-xs text-gray-500">
                        How much context the model can consider from documentation.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Behavior Tab */}
              {activeTab === 'behavior' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="persona" className="text-sm font-medium">Chatbot Persona</label>
                    <select
                      id="persona"
                      name="persona"
                      value={formData.persona}
                      onChange={handleChange}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="helpful">Helpful (General purpose)</option>
                      <option value="technical">Technical (Detailed and precise)</option>
                      <option value="friendly">Friendly (Conversational and approachable)</option>
                      <option value="concise">Concise (Brief and to the point)</option>
                      <option value="educational">Educational (Explains concepts thoroughly)</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      The personality and tone your chatbot will use in responses.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="responseLength" className="text-sm font-medium">Response Length</label>
                    <select
                      id="responseLength"
                      name="responseLength"
                      value={formData.responseLength}
                      onChange={handleChange}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="concise">Concise (Short answers)</option>
                      <option value="balanced">Balanced (Moderate length)</option>
                      <option value="comprehensive">Comprehensive (Detailed explanations)</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      Preferred length of chatbot responses.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="systemPrompt" className="text-sm font-medium">System Prompt</label>
                    <div className="relative">
                      <textarea
                        id="systemPrompt"
                        name="systemPrompt"
                        value={formData.systemPrompt}
                        onChange={handleChange}
                        rows={6}
                        className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Enter custom instructions for your chatbot..."
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      These instructions define how your chatbot will behave. Include details about its role, 
                      knowledge domain, tone, and any specific behavior guidance.
                    </p>
                    <div className="mt-2 p-3 bg-gray-50 rounded-md text-xs border border-gray-200">
                      <p className="font-medium text-gray-700 mb-1">Tips for effective system prompts:</p>
                      <ul className="list-disc pl-4 space-y-1 text-gray-600">
                        <li>Start with a clear role definition (e.g., "You are a documentation assistant...")</li>
                        <li>Specify the domain of knowledge ("...specializing in our product API")</li>
                        <li>Define the tone (formal, friendly, technical)</li>
                        <li>Include guidance on handling uncertain information</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-yellow-50 rounded-md">
                    <h3 className="text-sm font-medium text-yellow-800 mb-2">Advanced Behavior Settings</h3>
                    <p className="text-xs text-yellow-700 mb-2">
                      After creating your chatbot, you'll have access to additional behavior settings:
                    </p>
                    <ul className="text-xs text-yellow-700 list-disc pl-5 space-y-1">
                      <li>Knowledge cutoff date configuration</li>
                      <li>Custom instructions and system prompts</li>
                      <li>User feedback collection settings</li>
                      <li>Follow-up question generation</li>
                    </ul>
                  </div>
                </div>
              )}
              
              {/* Appearance Tab */}
              {activeTab === 'appearance' && (
                <div className="space-y-6">
                  {/* Logo Upload Section */}
                  <div className="space-y-4">
                    <label className="text-sm font-medium">Chatbot Logo</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                      {logoPreview ? (
                        <div className="text-center">
                          <div className="mb-4">
                            <img
                              src={logoPreview}
                              alt="Logo preview"
                              className="max-w-32 max-h-32 mx-auto rounded-lg shadow-sm object-contain"
                            />
                          </div>
                          <div className="flex justify-center space-x-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleRemoveLogo}
                              disabled={logoUploading}
                            >
                              Remove Logo
                            </Button>
                            <label htmlFor="logoUpload">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={logoUploading}
                                asChild
                              >
                                <span>Change Logo</span>
                              </Button>
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <label
                            htmlFor="logoUpload"
                            className="cursor-pointer"
                          >
                            <span className="mt-2 block text-sm font-medium text-gray-900">
                              Upload a logo for your chatbot
                            </span>
                            <span className="mt-1 block text-sm text-gray-500">
                              PNG, JPG, GIF, SVG or WebP up to 5MB
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              className="mt-3"
                              disabled={logoUploading}
                              asChild
                            >
                              <span>Choose File</span>
                            </Button>
                          </label>
                        </div>
                      )}
                      <input
                        id="logoUpload"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                        disabled={logoUploading}
                      />
                    </div>
                    {logoError && (
                      <p className="text-sm text-red-600 mt-1">{logoError}</p>
                    )}
                    {logoUploading && (
                      <p className="text-sm text-blue-600 mt-1">Uploading logo...</p>
                    )}
                    <p className="text-xs text-gray-500">
                      This logo will appear in your chatbot interface. If no logo is uploaded, a generic chatbot icon will be used.
                    </p>
                  </div>

                  {/* Favicon Upload Section */}
                  <FaviconUploader
                    value={formData.favicon}
                    onChange={handleFaviconConfigChange}
                    faviconFile={faviconFile}
                    onFileChange={handleFaviconChange}
                    faviconPreview={faviconPreview}
                    faviconError={faviconError}
                  />

                  <div className="space-y-2">
                    <label htmlFor="primaryColor" className="text-sm font-medium">Primary Color</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        id="primaryColor"
                        name="primaryColor"
                        value={formData.primaryColor}
                        onChange={handleChange}
                        className="h-10 w-10 rounded-md border border-slate-200 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={formData.primaryColor}
                        onChange={handleChange}
                        name="primaryColor"
                        className="w-32"
                      />
                      <p className="text-sm text-gray-500">Theme color for your chatbot interface</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="bubbleStyle" className="text-sm font-medium">Chat Bubble Style</label>
                    <select
                      id="bubbleStyle"
                      name="bubbleStyle"
                      value={formData.bubbleStyle}
                      onChange={handleChange}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="rounded">Rounded (Modern)</option>
                      <option value="square">Square (Minimal)</option>
                      <option value="bubbles">Bubbles (iOS-style)</option>
                    </select>
                    <p className="text-xs text-gray-500">
                      The visual style of chat messages.
                    </p>
                  </div>
                  
                  <div className="p-4 bg-blue-50 rounded-md">
                    <h3 className="text-sm font-medium text-blue-800 mb-2">Customization Preview</h3>
                    <p className="text-xs text-blue-700 mb-4">
                      After creation, you'll be able to further customize:
                    </p>
                    <div className="bg-white rounded-md p-3 border border-gray-200">
                      <div className="flex items-start space-x-2 mb-3">
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
                          {logoPreview ? (
                            <img src={logoPreview} alt="Logo" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold" style={{ color: formData.primaryColor }}>
                              {formData.name.charAt(0) || 'C'}
                            </span>
                          )}
                        </div>
                        <div className="bg-gray-100 rounded-lg p-2 max-w-xs">
                          <p className="text-sm">Hello! How can I help you today?</p>
                        </div>
                      </div>
                      <div className="flex justify-end mb-3">
                        <div 
                          className="p-2 max-w-xs rounded-lg text-white"
                          style={{ backgroundColor: formData.primaryColor }}
                        >
                          <p className="text-sm">How do I reset my password?</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex-shrink-0 flex items-center justify-center">
                          {logoPreview ? (
                            <img src={logoPreview} alt="Logo" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <span className="text-xs font-bold" style={{ color: formData.primaryColor }}>
                              {formData.name.charAt(0) || 'C'}
                            </span>
                          )}
                        </div>
                        <div className="bg-gray-100 rounded-lg p-2 max-w-xs">
                          <p className="text-sm">To reset your password, go to the login page and click on "Forgot Password".</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </CardContent>
          
          <CardFooter className="flex justify-between bg-gradient-to-r from-muted/20 to-muted/30 border-t border-border">
            <Button
              asChild
              variant="outline"
              className="border-border hover:bg-muted/50"
            >
              <Link href="/dashboard/chatbots">
                Cancel
              </Link>
            </Button>
            <Button
              onClick={handleSubmit}
              variant="gradient"
              size="lg"
              className="shadow-lg shadow-purple-500/25"
              disabled={loading || !formData.name.trim() || logoUploading || faviconUploading || isDeploying}
            >
              {isDeploying ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2" />
                  Deploying...
                </div>
              ) : loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2" />
                  Creating...
                </div>
              ) : logoUploading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2" />
                  Uploading logo...
                </div>
              ) : faviconUploading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2" />
                  Uploading favicon...
                </div>
              ) : (
                <div className="flex items-center">
                  <div className="w-4 h-4 mr-2">✨</div>
                  Create Chatbot
                </div>
              )}
            </Button>
          </CardFooter>
        </Card>

        <div className="mt-8 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <Card variant="premium" className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-purple-500 to-blue-500 text-white">
              <CardTitle className="text-xl flex items-center">
                <div className="w-6 h-6 mr-3">🚀</div>
                What happens next?
              </CardTitle>
              <CardDescription className="text-purple-100">
                Here's your journey to launching your AI chatbot
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold shadow-lg">
                      1
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-lg font-semibold text-foreground flex items-center">
                      <div className="w-5 h-5 mr-2">📁</div>
                      Upload Documents
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                      After creating your chatbot, you'll be prompted to upload documentation files that will train your AI. Supports PDFs, Word docs, text files, and more.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white font-bold shadow-lg">
                      2
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-lg font-semibold text-foreground flex items-center">
                      <div className="w-5 h-5 mr-2">⚡</div>
                      Process and Optimize
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                      Your documents will be processed, chunked, and converted into AI-ready embeddings using advanced vector databases for lightning-fast responses.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white font-bold shadow-lg">
                      3
                    </div>
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-lg font-semibold text-foreground flex items-center">
                      <div className="w-5 h-5 mr-2">🎨</div>
                      Customize and Deploy
                    </h3>
                    <p className="mt-2 text-muted-foreground">
                      Fine-tune your chatbot's appearance and behavior, then deploy it to your website with a simple embed code or use our hosted solution.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-700">
                <div className="flex items-center">
                  <div className="w-6 h-6 mr-3">💡</div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-blue-900 dark:text-blue-200">Pro Tip</p>
                    <p className="text-sm text-blue-800 dark:text-blue-100 font-medium">Start with a few high-quality documents for better results, then expand your knowledge base over time.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <VectorStoreNameDialog
        isOpen={showVectorDialog}
        onConfirm={handleConfirmVectorstore}
        onCancel={() => {
          if (!isDeploying) {
            setShowVectorDialog(false);
          }
        }}
        userId={user?.uid || ''}
        embeddingModel={formData.embeddingModel}
        isValidating={isDeployingPreview}
      />
      
      {/* Deployment Progress Overlay */}
      {renderDeploymentOverlay()}
    </div>
  );
}
