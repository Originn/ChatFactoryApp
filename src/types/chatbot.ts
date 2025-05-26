import { Timestamp } from 'firebase/firestore';

export interface ChatbotConfig {
  id: string;
  userId: string;
  name: string;
  description: string;
  domain: string;
  requireAuth: boolean; // Whether users need to authenticate to use this chatbot
  logoUrl?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: 'draft' | 'active' | 'paused' | 'archived';
  documents: string[]; // Array of document IDs
  aiConfig: {
    embeddingModel: string;
    llmModel: string;
    temperature: number;
    contextWindow: number;
  };
  behavior: {
    persona: string;
    responseLength: string;
    systemPrompt: string;
  };
  appearance: {
    primaryColor: string;
    bubbleStyle: string;
  };
  stats: {
    queries: number;
    successRate: number;
    lastUpdated: Timestamp;
  };
  // Authentication settings (when requireAuth is true)
  authConfig?: {
    allowSignup: boolean;
    requireEmailVerification: boolean;
    allowGoogleAuth: boolean;
    allowAnonymousUsers: boolean;
    sessionTimeout: number; // in minutes
    maxConcurrentSessions: number;
  };
}

export interface ChatbotUser {
  id: string;
  chatbotId: string;
  email?: string;
  displayName?: string;
  isAnonymous: boolean;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  totalSessions: number;
  totalQueries: number;
  preferences?: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
  };
}

export interface ChatSession {
  id: string;
  chatbotId: string;
  userId?: string; // Optional for anonymous users
  startedAt: Timestamp;
  endedAt?: Timestamp;
  messageCount: number;
  satisfied?: boolean; // User feedback
  metadata: {
    userAgent?: string;
    ipAddress?: string;
    referrer?: string;
  };
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  chatbotId: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Timestamp;
  metadata?: {
    tokensUsed?: number;
    responseTime?: number;
    sourceDocs?: string[];
    confidence?: number;
  };
}

// Form data for creating new chatbots
export interface CreateChatbotData {
  name: string;
  description: string;
  domain: string;
  requireAuth: boolean;
  embeddingModel: string;
  llmModel: string;
  temperature: string;
  contextWindow: string;
  persona: string;
  responseLength: string;
  systemPrompt: string;
  primaryColor: string;
  bubbleStyle: string;
}

// Deployment configuration
export interface ChatbotDeployment {
  chatbotId: string;
  vercelProjectId?: string;
  deploymentUrl?: string;
  customDomain?: string;
  status: 'pending' | 'deploying' | 'deployed' | 'failed';
  deployedAt?: Timestamp;
  lastDeploymentAt?: Timestamp;
  environmentVariables: Record<string, string>;
}
