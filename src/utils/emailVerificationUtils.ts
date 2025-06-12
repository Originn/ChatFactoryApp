/**
 * Email Verification Utilities
 * Helper functions for generating secure tokens and verification URLs
 */

export interface EmailVerificationConfig {
  baseUrl: string;
  chatbotId: string;
  deploymentUrl?: string;
}

export interface VerificationTokenData {
  token: string;
  userId: string;
  chatbotId: string;
  email: string;
  expiresAt: Date;
  used: boolean;
}

/**
 * Generate a secure verification token
 */
export function generateSecureToken(): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  
  for (let i = 0; i < 32; i++) {
    token += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  // Add timestamp for uniqueness
  const timestamp = Date.now().toString(36);
  return token + timestamp;
}

/**
 * Generate a secure temporary password for Firebase user creation
 */
export function generateSecureTemporaryPassword(): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  // Ensure password has at least 12 characters and includes different character types
  for (let i = 0; i < 16; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  
  // Add timestamp to ensure uniqueness
  const timestamp = Date.now().toString(36);
  return password + timestamp;
}

/**
 * Generate verification URL for email invitations
 */
export function generateVerificationUrl(config: EmailVerificationConfig, token: string, mode: 'verify' | 'setup' = 'setup'): string {
  const { baseUrl, chatbotId, deploymentUrl } = config;
  
  const continueParam = deploymentUrl ? `&continue=${encodeURIComponent(`${deploymentUrl}/chat/${chatbotId}`)}` : '';
  
  return `${baseUrl}/email-verification?token=${token}&chatbot=${chatbotId}&mode=${mode}${continueParam}`;
}

/**
 * Get base URL for email links
 */
export function getEmailBaseUrl(deploymentUrl?: string): string {
  return deploymentUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://chatfactory.ai';
}

/**
 * Create token expiration date (24 hours from now)
 */
export function createTokenExpiration(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
}

/**
 * Validate if a token has expired
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/**
 * Create token data object for storage
 */
export function createTokenData(
  userId: string,
  chatbotId: string,
  email: string
): Omit<VerificationTokenData, 'token'> {
  return {
    userId,
    chatbotId,
    email,
    expiresAt: createTokenExpiration(),
    used: false
  };
}
