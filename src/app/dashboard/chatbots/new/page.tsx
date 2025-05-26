'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";
import UserDropdown from "@/components/dashboard/UserDropdown";
import { useRouter } from 'next/navigation';
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { uploadLogo, validateLogoFile } from "@/lib/utils/logoUpload";
import { Info } from "lucide-react";

export default function NewChatbotPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    // Basic Info
    name: '',
    description: '',
    domain: '',
    requireAuth: false, // New: Authentication requirement
    
    // AI Configuration
    embeddingModel: 'text-embedding-3-small',
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
  });
  
  const [activeTab, setActiveTab] = useState<'basic' | 'ai' | 'behavior' | 'appearance'>('basic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Logo upload state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle switch/boolean changes
  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
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
      
      // Prepare data for Firestore
      const chatbotData = {
        id: newChatbotRef.id,
        userId: user.uid,
        name: formData.name.trim(),
        description: formData.description.trim(),
        domain: formData.domain.trim(),
        requireAuth: formData.requireAuth, // Authentication requirement setting
        logoUrl: logoUrl, // Add logo URL to the data
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'draft',
        documents: [],
        aiConfig: {
          embeddingModel: formData.embeddingModel,
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
        },
        stats: {
          queries: 0,
          successRate: 0,
          lastUpdated: serverTimestamp(),
        }
      };
      
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
      
      // Redirect to the new chatbot's page
      router.push(`/dashboard/chatbots/${newChatbotRef.id}`);
    } catch (err: any) {
      console.error('Error creating chatbot:', err);
      setError(err.message || 'Failed to create chatbot. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center font-bold text-xl">
                Chat Factory
              </div>
              <nav className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/dashboard"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/chatbots"
                  className="border-blue-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Chatbots
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
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
      <main className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Create New Chatbot</h1>
          <Button
            asChild
            variant="outline"
          >
            <Link href="/dashboard/chatbots">
              Cancel
            </Link>
          </Button>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Create Your Chatbot</CardTitle>
            <CardDescription>
              Configure your chatbot's settings to best suit your documentation and user needs.
            </CardDescription>
          </CardHeader>
          
          {/* Tab Navigation */}
          <div className="px-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-6">
              <button
                onClick={() => setActiveTab('basic')}
                className={`${
                  activeTab === 'basic'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Basic Info
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`${
                  activeTab === 'ai'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                AI Configuration
              </button>
              <button
                onClick={() => setActiveTab('behavior')}
                className={`${
                  activeTab === 'behavior'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Behavior
              </button>
              <button
                onClick={() => setActiveTab('appearance')}
                className={`${
                  activeTab === 'appearance'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Appearance
              </button>
            </nav>
          </div>
          
          <CardContent className="pt-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">Chatbot Name *</label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="e.g., Product Documentation Assistant"
                      required
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">
                      Choose a clear, descriptive name for your chatbot.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="description" className="text-sm font-medium">Description</label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      placeholder="Describe what this chatbot will help users with..."
                      rows={3}
                      className="flex h-auto w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <p className="text-xs text-gray-500">
                      Provide details about what kind of questions this chatbot will answer.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="domain" className="text-sm font-medium">Custom Domain (Optional)</label>
                    <div className="flex">
                      <Input
                        id="domain"
                        name="domain"
                        value={formData.domain}
                        onChange={handleChange}
                        placeholder="your-chatbot"
                        className="rounded-r-none"
                      />
                      <span className="inline-flex items-center rounded-r-md border border-l-0 border-slate-200 bg-gray-50 px-3 text-gray-500 sm:text-sm">
                        .chatfactory.yourdomain.com
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Set a custom subdomain for accessing your chatbot.
                    </p>
                  </div>
                  
                  {/* Authentication Option */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        <label htmlFor="requireAuth" className="text-sm font-medium">
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
                                </ul>
                                <p className="mt-2 font-medium">Benefits:</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                  <li>Personalized chat experience</li>
                                  <li>Chat history persistence</li>
                                  <li>User engagement analytics</li>
                                  <li>Premium feature access control</li>
                                </ul>
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
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                    </select>
                    <p className="text-xs text-gray-500">
                      Choose which embedding model to use for document vectorization.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <label htmlFor="llmModel" className="text-sm font-medium">LLM Model *</label>
                    <select
                      id="llmModel"
                      name="llmModel"
                      value={formData.llmModel}
                      onChange={handleChange}
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                        className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                        className="flex min-h-[120px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                      className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
          
          <CardFooter className="flex justify-between">
            <Button
              asChild
              variant="outline"
            >
              <Link href="/dashboard/chatbots">
                Cancel
              </Link>
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={loading || !formData.name.trim()}
            >
              {loading ? 'Creating...' : 'Create Chatbot'}
            </Button>
          </CardFooter>
        </Card>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>What happens next?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-medium">
                      1
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium">Upload Documents</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      After creating your chatbot, you'll be prompted to upload documentation files that will train your AI.
                    </p>
                  </div>
                </div>
                
                <div className="flex">
                  <div className="flex-shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-medium">
                      2
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium">Process and Optimize</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Your documents will be processed, chunked, and converted into AI-ready embeddings.
                    </p>
                  </div>
                </div>
                
                <div className="flex">
                  <div className="flex-shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-medium">
                      3
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-sm font-medium">Customize and Deploy</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Adjust your chatbot's appearance and behavior, then deploy it to your website or application.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
