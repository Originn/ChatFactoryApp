// src/types/deployment.ts
import { Timestamp } from 'firebase/firestore';

export interface DeploymentRecord {
  id: string;
  chatbotId: string;
  userId: string;
  status: 'pending' | 'deploying' | 'deployed' | 'failed' | 'deleted';
  
  // Vercel integration
  vercelProjectId?: string;
  vercelDeploymentId?: string;
  deploymentUrl?: string;
  customDomain?: string;
  
  // Firebase project integration (separate projects approach)
  firebaseProjectId?: string;
  firebaseConfig?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  
  // Deployment configuration
  subdomain: string; // generated subdomain like "chatbot-name"
  branding: {
    show: boolean;
    text: string;
    link: string;
  };
  
  // Limitations based on plan
  planLimitations: {
    monthlyQueryLimit: number;
    analyticsRetention: number; // days
    customDomain: boolean;
    branding: boolean;
  };
  
  // Usage tracking
  usage: {
    totalQueries: number;
    monthlyQueries: number;
    lastQueryAt?: Timestamp;
    lastResetAt: Timestamp;
  };
  
  // Timestamps
  createdAt: Timestamp;
  deployedAt?: Timestamp;
  lastDeploymentAt?: Timestamp;
  updatedAt: Timestamp;
  
  // Environment variables for deployment
  environmentVariables: Record<string, string>;
  
  // Error tracking
  lastError?: {
    message: string;
    code: string;
    timestamp: Timestamp;
  };
}

export interface QueryUsageRecord {
  id: string;
  deploymentId: string;
  chatbotId: string;
  userId: string;
  
  // Query details
  query: string;
  response: string;
  timestamp: Timestamp;
  
  // Performance metrics
  responseTime: number; // milliseconds
  tokensUsed: number;
  
  // User context
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  
  // Billing
  planType: 'free' | 'pro' | 'enterprise';
  counted: boolean; // whether this query counts against limits
}

export interface DeploymentUsageStats {
  deploymentId: string;
  userId: string;
  
  // Current period stats
  currentMonth: {
    year: number;
    month: number;
    queries: number;
    uniqueUsers: number;
    avgResponseTime: number;
  };
  
  // Historical data (for Pro+ plans)
  historicalMonths: Array<{
    year: number;
    month: number;
    queries: number;
    uniqueUsers: number;
    avgResponseTime: number;
  }>;
  
  // Daily breakdown (last 30 days)
  dailyStats: Array<{
    date: string; // YYYY-MM-DD
    queries: number;
    uniqueUsers: number;
    avgResponseTime: number;
  }>;
  
  // Real-time counters
  todayQueries: number;
  thisWeekQueries: number;
  
  updatedAt: Timestamp;
}

// Updated user profile with deployment fields
export interface UpdatedUserProfile {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  subscription: {
    plan: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'inactive' | 'cancelled' | 'past_due';
    expiresAt?: Timestamp;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  };
  
  usage: {
    chatbotsCreated: number;
    totalQueries: number;
    monthlyQueries: number;
    lastResetAt: Timestamp;
    
    // New deployment-specific fields
    deploymentsCreated: number;
    activeDeployments: number;
    monthlyDeployments: number; // for rate limiting
    lastDeploymentAt?: Timestamp;
  };
  
  // Deployment preferences
  deploymentPreferences: {
    defaultSubdomain?: string;
    preferredRegion: string;
    notifications: {
      deploymentSuccess: boolean;
      usageLimits: boolean;
      monthlyReports: boolean;
    };
  };
  
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    emailNotifications: boolean;
    marketingEmails: boolean;
  };
  
  metadata: {
    lastLoginAt?: Timestamp;
    loginCount: number;
    ipAddress?: string;
    userAgent?: string;
  };
}

// Plan limitations configuration
export const PLAN_LIMITS = {
  free: {
    maxChatbots: 2,
    monthlyQueries: 100,
    monthlyDeployments: 3,
    customDomain: false,
    branding: true,
    analyticsRetention: 7, // days
    support: 'community'
  },
  pro: {
    maxChatbots: 10,
    monthlyQueries: 2000,
    monthlyDeployments: 20,
    customDomain: true,
    branding: false,
    analyticsRetention: 90, // days
    support: 'email'
  },
  enterprise: {
    maxChatbots: -1, // unlimited
    monthlyQueries: -1, // unlimited
    monthlyDeployments: -1, // unlimited
    customDomain: true,
    branding: false,
    analyticsRetention: 365, // days
    support: 'priority'
  }
} as const;
