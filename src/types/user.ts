import { Timestamp } from 'firebase/firestore';

export interface UserProfile {
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
  };
  usage: {
    chatbotsCreated: number;
    totalQueries: number;
    monthlyQueries: number;
    lastResetAt: Timestamp;
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

export interface CreateUserProfileData {
  email: string;
  displayName: string;
  emailVerified?: boolean;
}

export interface UpdateUserProfileData {
  displayName?: string;
  preferences?: Partial<UserProfile['preferences']>;
}

export interface UserSubscription {
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'inactive' | 'cancelled' | 'past_due';
  expiresAt?: Timestamp;
}

export interface UserUsage {
  chatbotsCreated: number;
  totalQueries: number;
  monthlyQueries: number;
  lastResetAt: Timestamp;
}

// Auth-related types
export interface SignupData {
  email: string;
  password: string;
  displayName: string;
  agreeToTerms: boolean;
}

export interface LoginData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface PasswordResetData {
  email: string;
}

export interface UpdatePasswordData {
  currentPassword: string;
  newPassword: string;
}
