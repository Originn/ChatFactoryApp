'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import UserDropdown from "@/components/dashboard/UserDropdown";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useRouter } from 'next/navigation';
import { db } from "@/lib/firebase/config";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

// Define the Chatbot type
interface Chatbot {
  id: string;
  name: string;
  description: string;
  domain?: string;
  status: string;
  createdAt: any;
  updatedAt: any;
  userId: string;
  documents?: any[];
  aiConfig?: {
    embeddingModel: string;
    llmModel: string;
    temperature: number;
    contextWindow: number;
  };
  behavior?: {
    persona: string;
    responseLength: string;
    systemPrompt: string;
  };
  appearance?: {
    primaryColor: string;
    bubbleStyle: string;
  };
  stats?: {
    queries: number;
    successRate: number;
    responseTime?: string;
  };
}

export default function EditChatbotPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const chatbotId = params.id as string;
  
  // Form state
  const [formData, setFormData] = useState({
    // Basic Info
    name: '',
    description: '',
    domain: '',
    status: 'draft',
    
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
  
  // UI state
  const [activeTab, setActiveTab] = useState<'basic' | 'ai' | 'behavior' | 'appearance'>('basic');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [originalChatbot, setOriginalChatbot] = useState<Chatbot | null>(null);
  
  // Fetch chatbot data
  useEffect(() => {
    async function fetchChatbotData() {
      if (!user || !chatbotId) {
        setIsLoading(false);
        return;
      }
      
      try {
        const chatbotRef = doc(db, "chatbots", chatbotId);
        const chatbotSnap = await getDoc(chatbotRef);
        
        if (chatbotSnap.exists()) {
          const chatbotData = chatbotSnap.data() as Omit<Chatbot, 'id'>;
          
          // Verify the chatbot belongs to the current user
          if (chatbotData.userId !== user.uid) {
            setError("You don't have permission to edit this chatbot");
            setIsLoading(false);
            return;
          }
          
          const chatbot = {
            id: chatbotSnap.id,
            ...chatbotData
          };
          
          setOriginalChatbot(chatbot);
          
          // Update form data with chatbot values
          setFormData({
            name: chatbot.name || '',
            description: chatbot.description || '',
            domain: chatbot.domain || '',
            status: chatbot.status || 'draft',
            
            embeddingModel: chatbot.aiConfig?.embeddingModel || 'text-embedding-3-small',
            llmModel: chatbot.aiConfig?.llmModel || 'gpt-4.1',
            temperature: String(chatbot.aiConfig?.temperature || 0.7),
            contextWindow: String(chatbot.aiConfig?.contextWindow || 4096),
            
            persona: chatbot.behavior?.persona || 'helpful',
            responseLength: chatbot.behavior?.responseLength || 'balanced',
            systemPrompt: chatbot.behavior?.systemPrompt || 'You are a helpful AI assistant for answering questions about our documentation. Use the provided context to answer the user\'s questions accurately. If you don\'t know the answer or if it\'s not in the provided documentation, say so clearly rather than making up information.',
            
            primaryColor: chatbot.appearance?.primaryColor || '#3b82f6',
            bubbleStyle: chatbot.appearance?.bubbleStyle || 'rounded',
          });
        } else {
          setError("Chatbot not found");
        }
      } catch (err: any) {
        console.error("Error fetching chatbot:", err);
        setError(err.message || "Failed to load chatbot");
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchChatbotData();
  }, [chatbotId, user]);
  
  // Form change handler
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear success message when user makes changes
    if (success) {
      setSuccess(null);
    }
  };
  
  // Save changes
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    
    if (!formData.name.trim()) {
      setError('Chatbot name is required');
      setIsSaving(false);
      return;
    }
    
    try {
      // Prepare the update data
      const updateData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        domain: formData.domain.trim() || null,
        status: formData.status,
        updatedAt: serverTimestamp(),
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
      };
      
      // Update in Firestore
      await updateDoc(doc(db, "chatbots", chatbotId), updateData);
      
      setSuccess('Chatbot updated successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error("Error updating chatbot:", err);
      setError(err.message || "Failed to update chatbot");
    } finally {
      setIsSaving(false);
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
                DocsAI
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

      {/* Edit Chatbot Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error && !originalChatbot ? (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
              <p className="font-medium">Error</p>
              <p>{error}</p>
              <div className="mt-4">
                <Button 
                  asChild
                  variant="outline"
                >
                  <Link href="/dashboard/chatbots">
                    Back to Chatbots
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-semibold text-gray-900">Edit Chatbot</h1>
                <div className="flex space-x-3">
                  <Button
                    asChild
                    variant="outline"
                  >
                    <Link href={`/dashboard/chatbots/${chatbotId}`}>
                      Cancel
                    </Link>
                  </Button>
                </div>
              </div>
              
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded mb-4">
                  {success}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Edit Form */}
                <div className="md:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Configure Your Chatbot</CardTitle>
                      <CardDescription>
                        Customize your chatbot's settings to best suit your documentation and user needs.
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
                                  .docsai.yourdomain.com
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">
                                Set a custom subdomain for accessing your chatbot.
                              </p>
                            </div>
                            
                            <div className="space-y-2">
                              <label htmlFor="status" className="text-sm font-medium">Status</label>
                              <select
                                id="status"
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <option value="draft">Draft - Not visible to users</option>
                                <option value="active">Active - Available for users</option>
                                <option value="paused">Paused - Temporarily inactive</option>
                              </select>
                              <p className="text-xs text-gray-500">
                                Control whether users can access your chatbot.
                              </p>
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
                            </div>
                          </div>
                        )}
                        
                        {/* Appearance Tab */}
                        {activeTab === 'appearance' && (
                          <div className="space-y-6">
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
                          </div>
                        )}
                      </form>
                    </CardContent>
                    
                    <CardFooter className="flex justify-between border-t p-6">
                      <Button
                        asChild
                        variant="outline"
                      >
                        <Link href={`/dashboard/chatbots/${chatbotId}`}>
                          Cancel
                        </Link>
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        className="bg-blue-600 hover:bg-blue-700"
                        disabled={isSaving}
                      >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
                
                {/* Live Preview */}
                <div className="md:col-span-1">
                  <h2 className="text-lg font-medium mb-4">Live Preview</h2>
                  <Card className="mb-6">
                    <CardContent className="p-6">
                      <div className="border rounded-lg bg-gray-50 p-4 mb-4 h-60 overflow-y-auto">
                        {/* Simulated chat messages */}
                        <div className="flex items-start space-x-2 mb-3">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center">
                            <span style={{ color: formData.primaryColor }} className="font-bold text-sm">{formData.name.charAt(0) || 'A'}</span>
                          </div>
                          <div className="bg-white rounded-lg p-2 shadow-sm max-w-xs">
                            <p className="text-sm">
                              Hello! I'm an AI assistant trained on {formData.name || 'your documentation'}. How can I help you today?
                            </p>
                          </div>
                        </div>
                        <div className="flex justify-end mb-3">
                          <div 
                            className="p-2 max-w-xs rounded-lg text-white shadow-sm"
                            style={{ backgroundColor: formData.primaryColor }}
                          >
                            <p className="text-sm">How do I get started?</p>
                          </div>
                        </div>
                        <div className="flex items-start space-x-2">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center">
                            <span style={{ color: formData.primaryColor }} className="font-bold text-sm">{formData.name.charAt(0) || 'A'}</span>
                          </div>
                          <div className="bg-white rounded-lg p-2 shadow-sm max-w-xs">
                            <p className="text-sm">
                              {formData.persona === 'concise' ? 
                                'Sign up, complete onboarding, and you\'re ready to go.' :
                                formData.persona === 'technical' ?
                                'To begin, navigate to the registration endpoint (/auth/register) to create an account with valid credentials. After verification, proceed to the onboarding wizard to configure initial settings.' :
                                'To get started, you\'ll need to sign up for an account and complete the onboarding process. Would you like me to guide you through the steps?'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="relative">
                        <input 
                          type="text" 
                          className="w-full px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Ask a question..."
                          disabled
                        />
                        <button 
                          className="absolute right-2 top-2 rounded-full p-1"
                          style={{ color: formData.primaryColor }}
                          disabled
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                          </svg>
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Your Changes</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <div className="space-y-2">
                        {formData.name !== originalChatbot?.name && (
                          <p className="py-1 px-2 bg-blue-50 rounded text-blue-800">
                            <span className="font-medium">Name:</span> {originalChatbot?.name} → {formData.name}
                          </p>
                        )}
                        {formData.status !== originalChatbot?.status && (
                          <p className="py-1 px-2 bg-blue-50 rounded text-blue-800">
                            <span className="font-medium">Status:</span> {originalChatbot?.status} → {formData.status}
                          </p>
                        )}
                        {formData.llmModel !== originalChatbot?.aiConfig?.llmModel && (
                          <p className="py-1 px-2 bg-blue-50 rounded text-blue-800">
                            <span className="font-medium">LLM Model:</span> {originalChatbot?.aiConfig?.llmModel} → {formData.llmModel}
                          </p>
                        )}
                        {formData.persona !== originalChatbot?.behavior?.persona && (
                          <p className="py-1 px-2 bg-blue-50 rounded text-blue-800">
                            <span className="font-medium">Persona:</span> {originalChatbot?.behavior?.persona} → {formData.persona}
                          </p>
                        )}
                        {formData.primaryColor !== originalChatbot?.appearance?.primaryColor && (
                          <p className="py-1 px-2 bg-blue-50 rounded text-blue-800">
                            <span className="font-medium">Color:</span> {originalChatbot?.appearance?.primaryColor} → {formData.primaryColor}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
