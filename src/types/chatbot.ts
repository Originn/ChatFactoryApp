import { Timestamp } from 'firebase/firestore';

// User invitation management
export interface InvitedUser {
  id: string;
  email: string;
  displayName?: string;
  invitedAt: Timestamp;
  invitedBy: string; // userId of the creator
  status: 'pending' | 'accepted' | 'disabled';
  lastSignInAt?: Timestamp;
  firebaseUid?: string; // Firebase user ID once they accept invitation
}

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
  status: 'draft' | 'preview' | 'active' | 'paused' | 'archived';
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
  // Vectorstore configuration
  vectorstore?: {
    provider: 'pinecone';
    indexName: string;
    dimension: number;
    metric: 'cosine' | 'euclidean' | 'dotproduct';
    region: string;
    createdAt: Timestamp;
    status: 'creating' | 'ready' | 'failed';
    documentsCount: number;
    lastDocumentUpload?: Timestamp;
  };
  // Deployment information
  deployment?: {
    vercelProjectId?: string;
    deploymentUrl?: string;
    customDomain?: string;
    status: 'pending' | 'deploying' | 'deployed' | 'failed';
    deployedAt?: Timestamp;
    lastDeploymentAt?: Timestamp;
  };
  // Authentication settings (when requireAuth is true)
  authConfig?: {
    accessMode: 'open' | 'managed'; // open = allow signups, managed = admin invites users
    allowSignup: boolean; // deprecated but kept for backwards compatibility
    requireEmailVerification: boolean;
    allowGoogleAuth: boolean;
    allowAnonymousUsers: boolean;
    sessionTimeout: number; // in minutes
    maxConcurrentSessions: number;
    // Firebase tenant management
    firebaseTenantId?: string; // Firebase tenant ID for this chatbot
    firebaseProjectId?: string; // Dedicated Firebase project ID (if using separate projects)
    invitedUsers: InvitedUser[]; // Users invited by the creator
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

// Firebase project details stored in chatbot document
export interface ChatbotFirebaseProject {
  projectId: string;
  displayName: string;
  status: 'creating' | 'active' | 'failed' | 'deleted';
  createdAt: Timestamp;
  createdBy: 'firebase-cli' | 'api' | 'manual';
  
  // Firebase services configured
  services: {
    auth: boolean;
    firestore: boolean;
    storage: boolean;
    hosting: boolean;
    functions?: boolean;
    analytics?: boolean;
  };
  
  // Project URLs for easy access
  urls: {
    console: string;
    auth: string;
    firestore: string;
    storage: string;
    hosting?: string;
  };
  
  // Configuration details
  config: {
    region: string;
    authDomain: string;
    storageBucket: string;
  };
  buckets?: {
    documents: string;
    privateImages: string;
    documentImages: string;
  };
  
  // Deployment information (populated when deployed)
  deployment?: {
    status: 'deployed' | 'failed';
    url: string;
    vercelProjectId: string;
    deployedAt: Timestamp;
  };
}

// Firebase project deletion metadata
export interface ChatbotFirebaseProjectDeleted {
  projectId: string;
  deletedAt: Timestamp;
  deletionMethod: 'firebase-cli' | 'manual' | 'cleanup';
}
