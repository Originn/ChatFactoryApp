'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SystemPromptWizardProps {
  currentPrompt: string;
  productName?: string;
  onPromptGenerated: (prompt: string) => void;
}

type ChatbotType = 'sales' | 'support' | 'assistant' | 'educational' | 'other';

export default function SystemPromptWizard({
  currentPrompt,
  productName: initialProductName = '',
  onPromptGenerated
}: SystemPromptWizardProps) {
  const [step, setStep] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [productName, setProductName] = useState(initialProductName);
  const [supportEmail, setSupportEmail] = useState('');
  const [chatbotType, setChatbotType] = useState<ChatbotType>('assistant');
  const [customType, setCustomType] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');

  // Refinement state
  const [workingPrompt, setWorkingPrompt] = useState('');
  const [refinementInput, setRefinementInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [refinementHistory, setRefinementHistory] = useState<Array<{
    type: 'user' | 'ai';
    content: string;
  }>>([]);

  const chatbotTypes: { value: ChatbotType; label: string; description: string }[] = [
    {
      value: 'sales',
      label: 'Sales Assistant',
      description: 'Helps convert prospects into customers, answers product questions, highlights benefits'
    },
    {
      value: 'support',
      label: 'Customer Support',
      description: 'Provides technical assistance, troubleshoots issues, helps with account problems'
    },
    {
      value: 'assistant',
      label: 'General Assistant',
      description: 'Answers general questions about your product or service'
    },
    {
      value: 'educational',
      label: 'Educational Tutor',
      description: 'Teaches concepts, explains topics in detail, provides learning guidance'
    },
    {
      value: 'other',
      label: 'Other (Custom)',
      description: 'Define your own chatbot role'
    },
  ];

  const handleGeneratePrompt = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-system-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productName,
          supportEmail,
          chatbotType: chatbotType === 'other' ? customType : chatbotType,
          additionalInstructions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate prompt');
      }

      const data = await response.json();
      setWorkingPrompt(data.systemPrompt);
      onPromptGenerated(data.systemPrompt);
      setStep(4); // Move to preview step
    } catch (err: any) {
      console.error('Error generating prompt:', err);
      setError(err.message || 'Failed to generate system prompt. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefinePrompt = async () => {
    if (!refinementInput.trim()) return;

    setIsRefining(true);
    setError(null);

    // Add user message to history
    const userMessage = { type: 'user' as const, content: refinementInput };
    setRefinementHistory(prev => [...prev, userMessage]);

    try {
      const response = await fetch('/api/refine-system-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPrompt: workingPrompt,
          refinementRequest: refinementInput,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to refine prompt');
      }

      const data = await response.json();
      const refinedPrompt = data.refinedPrompt;

      // Add AI response to history
      const aiMessage = { type: 'ai' as const, content: refinedPrompt };
      setRefinementHistory(prev => [...prev, aiMessage]);

      // Update working prompt and apply to form
      setWorkingPrompt(refinedPrompt);
      onPromptGenerated(refinedPrompt);

      // Clear input
      setRefinementInput('');
    } catch (err: any) {
      console.error('Error refining prompt:', err);
      setError(err.message || 'Failed to refine system prompt. Please try again.');
      // Remove the user message if refinement failed
      setRefinementHistory(prev => prev.slice(0, -1));
    } finally {
      setIsRefining(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setError(null);
    setRefinementHistory([]);
    setRefinementInput('');
    setWorkingPrompt('');
  };

  const canProceedFromStep1 = productName.trim().length > 0;
  const canProceedFromStep2 = chatbotType !== 'other' || customType.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center space-x-2 mb-8">
        {[1, 2, 3].map((stepNum) => (
          <div key={stepNum} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                step >= stepNum
                  ? 'bg-blue-600 dark:bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {stepNum}
            </div>
            {stepNum < 3 && (
              <div
                className={`w-16 h-1 ${
                  step > stepNum ? 'bg-blue-600 dark:bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Product/Company Name */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Product Information</CardTitle>
            <CardDescription>
              Tell us about the product or company your chatbot will assist with
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="productName">Product/Company Name *</Label>
              <Input
                id="productName"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g., Acme Software, MyApp, TechCorp"
                className="w-full"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This will be used to personalize your chatbot's responses
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supportEmail">Support Contact Email (Optional)</Label>
              <Input
                id="supportEmail"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="e.g., support@yourcompany.com"
                className="w-full"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                If provided, your chatbot will direct users to contact this email for additional support when needed
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                onClick={() => setStep(2)}
                disabled={!canProceedFromStep1}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Next Step
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Chatbot Type */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Chatbot Role</CardTitle>
            <CardDescription>
              What is the primary purpose of your chatbot?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              {chatbotTypes.map((type) => (
                <div
                  key={type.value}
                  onClick={() => setChatbotType(type.value)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    chatbotType === type.value
                      ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start">
                    <div
                      className={`w-5 h-5 rounded-full border-2 mt-0.5 mr-3 flex items-center justify-center ${
                        chatbotType === type.value
                          ? 'border-blue-600 dark:border-blue-500 bg-blue-600 dark:bg-blue-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {chatbotType === type.value && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{type.label}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{type.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {chatbotType === 'other' && (
              <div className="space-y-2 mt-4">
                <Label htmlFor="customType">Describe Your Chatbot's Role *</Label>
                <Input
                  id="customType"
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="e.g., Legal advisor, Recipe helper, Travel guide"
                  className="w-full"
                />
              </div>
            )}

            <div className="flex justify-between space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!canProceedFromStep2}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Next Step
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Additional Instructions & Generate */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Additional Instructions (Optional)</CardTitle>
            <CardDescription>
              Any specific behavior or guidelines for your chatbot?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="additionalInstructions">Custom Instructions</Label>
              <textarea
                id="additionalInstructions"
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                placeholder="e.g., Always be formal, Focus on technical details, Include pricing when relevant..."
                rows={6}
                className="flex w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm ring-offset-white dark:ring-offset-slate-950 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Optional: Add any specific guidelines, tone preferences, or topics to emphasize
              </p>
            </div>

            {/* Template Variables Info Box */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-2">
                    📝 About Template Variables
                  </h4>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-3">
                    You may see special keywords like <code className="bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 rounded text-xs font-mono">&#123;language&#125;</code> and <code className="bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 rounded text-xs font-mono">CONTEXT</code> in your generated prompt. These are automatically replaced at runtime:
                  </p>
                  <ul className="space-y-2 text-sm text-indigo-700 dark:text-indigo-300">
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span><code className="bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 rounded text-xs font-mono">&#123;language&#125;</code> - Automatically detects and uses the user's language for responses</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span><code className="bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 rounded text-xs font-mono">&#123;context&#125;</code> or <code className="bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 rounded text-xs font-mono">CONTEXT</code> - Relevant information from your knowledge base to answer questions</span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2">•</span>
                      <span><code className="bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 rounded text-xs font-mono">&#123;imageDescription&#125;</code> - Description of any images the user uploads</span>
                    </li>
                  </ul>
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-3 italic">
                    💡 Don't remove these - they're essential for your chatbot to work properly!
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Ready to Generate!</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                We'll use AI to create a professional system prompt based on your inputs:
              </p>
              <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 ml-4 list-disc">
                <li>Product: <span className="font-semibold">{productName}</span></li>
                {supportEmail && (
                  <li>Support Email: <span className="font-semibold">{supportEmail}</span></li>
                )}
                <li>Role: <span className="font-semibold">
                  {chatbotType === 'other' ? customType : chatbotTypes.find(t => t.value === chatbotType)?.label}
                </span></li>
                {additionalInstructions && (
                  <li>Custom instructions included</li>
                )}
              </ul>
            </div>

            <div className="flex justify-between space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                disabled={isGenerating}
              >
                Back
              </Button>
              <Button
                onClick={handleGeneratePrompt}
                disabled={isGenerating}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  'Generate System Prompt'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Preview & Confirm */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>✨ System Prompt Generated!</CardTitle>
            <CardDescription>
              Review your AI-generated system prompt below
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto">
              <div className="whitespace-pre-wrap text-sm font-mono text-gray-800 dark:text-gray-200">
                {workingPrompt}
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-sm text-green-700 dark:text-green-300">
                ✅ This prompt has been automatically applied to your chatbot configuration.
                You can refine it with AI or edit it manually in the text area below.
              </p>
            </div>

            {/* Template Variables Info Box */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-lg p-3">
              <details className="cursor-pointer">
                <summary className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 flex items-center">
                  <svg className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  What are <code className="bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 rounded text-xs font-mono mx-1">&#123;language&#125;</code> and <code className="bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 rounded text-xs font-mono">CONTEXT</code>?
                </summary>
                <div className="mt-3 pl-6 text-sm text-indigo-700 dark:text-indigo-300 space-y-2">
                  <p>These are <strong>template variables</strong> that are automatically replaced when your chatbot runs:</p>
                  <ul className="space-y-1.5 ml-4">
                    <li>• <code className="bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 rounded text-xs font-mono">&#123;language&#125;</code> - User's detected language</li>
                    <li>• <code className="bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 rounded text-xs font-mono">&#123;context&#125;</code> - Relevant info from your knowledge base</li>
                    <li>• <code className="bg-indigo-100 dark:bg-indigo-900 px-1 py-0.5 rounded text-xs font-mono">&#123;imageDescription&#125;</code> - Uploaded image descriptions</li>
                  </ul>
                  <p className="text-xs italic mt-2">💡 Keep these - they're essential for your chatbot!</p>
                </div>
              </details>
            </div>

            <div className="flex justify-between space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={resetWizard}
              >
                Start Over
              </Button>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(5)}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  🤖 Refine with AI
                </Button>
                <Button
                  onClick={() => setStep(0)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Done
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: AI Refinement Chat */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>🤖 Refine Your System Prompt with AI</CardTitle>
            <CardDescription>
              Describe how you'd like to improve the prompt, and AI will refine it for you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Prompt Display */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Current Prompt:</Label>
              <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-48 overflow-y-auto">
                <div className="whitespace-pre-wrap text-xs font-mono text-gray-800 dark:text-gray-200">
                  {workingPrompt}
                </div>
              </div>
            </div>

            {/* Refinement History */}
            {refinementHistory.length > 0 && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">Refinement History:</Label>
                <div className="space-y-3 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  {refinementHistory.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          message.type === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                        }`}
                      >
                        <div className="text-xs font-semibold mb-1">
                          {message.type === 'user' ? 'You' : 'AI'}
                        </div>
                        <div className="text-sm whitespace-pre-wrap font-mono">
                          {message.type === 'user' ? message.content : (
                            <div className="max-h-32 overflow-y-auto">
                              {message.content}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Refinement Input */}
            <div className="space-y-2">
              <Label htmlFor="refinementInput">How would you like to improve the prompt?</Label>
              <textarea
                id="refinementInput"
                value={refinementInput}
                onChange={(e) => setRefinementInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.ctrlKey) {
                    handleRefinePrompt();
                  }
                }}
                placeholder="e.g., Make it more formal, Add emphasis on customer service, Include technical troubleshooting..."
                rows={3}
                disabled={isRefining}
                className="flex w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm ring-offset-white dark:ring-offset-slate-950 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Press Ctrl+Enter to send
              </p>
            </div>

            <div className="flex justify-between space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setStep(4)}
                disabled={isRefining}
              >
                Back to Preview
              </Button>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setStep(0)}
                  disabled={isRefining}
                >
                  Done
                </Button>
                <Button
                  onClick={handleRefinePrompt}
                  disabled={isRefining || !refinementInput.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isRefining ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Refining...
                    </>
                  ) : (
                    '✨ Refine Prompt'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Show wizard trigger when not in wizard mode */}
      {step === 0 && (
        <div className="text-center">
          <Button
            onClick={() => setStep(1)}
            variant="outline"
            className="w-full"
          >
            🪄 Use AI Wizard to Generate System Prompt
          </Button>
        </div>
      )}
    </div>
  );
}
