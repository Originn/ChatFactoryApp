import crypto from 'crypto';
import { adminDb } from '@/lib/firebase/admin/index';

/**
 * Secure token utilities for YouTube OAuth
 */

/**
 * Decrypt stored tokens (compatible with both old and new formats)
 */
export function decrypt(text: string): string {
  try {
    const key = process.env.YOUTUBE_KEYS_ENCRYPTION_KEY || 'your-32-character-secret-key-here!!';
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = textParts.join(':');
    
    // Try modern method first (for new tokens)
    try {
      const keyBuffer = crypto.scryptSync(key, 'salt', 32);
      const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
      
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (modernError) {
      // Fallback to legacy method for old tokens (if they exist)
      try {
        const decipher = crypto.createDecipher('aes-256-cbc', key);
        
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
      } catch (legacyError) {
        throw modernError; // Throw the first error
      }
    }
  } catch (error) {
    console.error('Token decryption failed:', error);
    throw new Error('Failed to decrypt token');
  }
}

/**
 * Encrypt tokens for storage (using modern secure method)
 */
export function encrypt(text: string): string {
  try {
    const key = process.env.YOUTUBE_KEYS_ENCRYPTION_KEY || 'your-32-character-secret-key-here!!';
    const iv = crypto.randomBytes(16);
    const keyBuffer = crypto.scryptSync(key, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Token encryption failed:', error);
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Get valid access token for user (auto-refresh if needed)
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  // Get stored tokens
  const tokenDoc = await adminDb
    .collection('user_youtube_tokens')
    .doc(userId)
    .get();

  if (!tokenDoc.exists) {
    throw new Error('YouTube account not connected');
  }

  const tokenData = tokenDoc.data()!;
  
  if (!tokenData.accessToken) {
    throw new Error('Invalid token data');
  }

  // Check if token needs refresh
  const connectedAt = tokenData.connectedAt.toDate();
  const lastRefreshed = tokenData.refreshedAt?.toDate() || connectedAt;
  const expiresAt = new Date(lastRefreshed.getTime() + (tokenData.expiresIn * 1000));
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

  const needsRefresh = expiresAt < fiveMinutesFromNow;

  if (needsRefresh && tokenData.refreshToken) {
    // Auto-refresh the token
    try {
      await refreshUserToken(userId);
      
      // Get the updated token
      const updatedDoc = await adminDb
        .collection('user_youtube_tokens')
        .doc(userId)
        .get();
      
      const updatedData = updatedDoc.data()!;
      return decrypt(updatedData.accessToken);
    } catch (error) {
      console.error('Auto-refresh failed:', error);
      throw new Error('Token expired and refresh failed - please reconnect');
    }
  }

  // Update lastUsed timestamp when accessing the token
  await adminDb
    .collection('user_youtube_tokens')
    .doc(userId)
    .update({
      lastUsed: new Date().toISOString()
    });

  return decrypt(tokenData.accessToken);
}

/**
 * Refresh user's access token
 */
async function refreshUserToken(userId: string): Promise<void> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('YouTube OAuth credentials not configured');
  }

  // Get stored tokens
  const tokenDoc = await adminDb
    .collection('user_youtube_tokens')
    .doc(userId)
    .get();

  if (!tokenDoc.exists) {
    throw new Error('No tokens found for user');
  }

  const tokenData = tokenDoc.data()!;
  
  if (!tokenData.refreshToken) {
    throw new Error('No refresh token available');
  }

  // Decrypt refresh token
  const refreshToken = decrypt(tokenData.refreshToken);

  // Refresh the access token
  const refreshParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: refreshParams.toString(),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('Token refresh failed:', { status: response.status, error: errorData });
    throw new Error('Failed to refresh access token');
  }

  const newTokens = await response.json();

  // Update stored tokens
  const updatedData: any = {
    ...tokenData,
    accessToken: encrypt(newTokens.access_token),
    expiresIn: newTokens.expires_in,
    lastUsed: new Date(),
    refreshedAt: new Date(),
  };

  // Update refresh token if a new one was provided
  if (newTokens.refresh_token) {
    updatedData.refreshToken = encrypt(newTokens.refresh_token);
  }

  await adminDb
    .collection('user_youtube_tokens')
    .doc(userId)
    .update(updatedData);
}

/**
 * Check if user has valid YouTube connection
 */
export async function checkUserConnection(userId: string): Promise<{
  isConnected: boolean;
  channelInfo?: any;
  error?: string;
}> {
  try {
    const tokenDoc = await adminDb
      .collection('user_youtube_tokens')
      .doc(userId)
      .get();

    if (!tokenDoc.exists) {
      return { isConnected: false };
    }

    const tokenData = tokenDoc.data()!;
    
    // Try to get a valid access token (this will auto-refresh if needed)
    await getValidAccessToken(userId);
    
    return {
      isConnected: true,
      channelInfo: tokenData.channelInfo,
    };
  } catch (error) {
    console.error('Connection check failed:', error);
    return {
      isConnected: false,
      error: error instanceof Error ? error.message : 'Connection check failed',
    };
  }
}

/**
 * Disconnect user's YouTube account
 */
export async function disconnectUser(userId: string): Promise<void> {
  try {
    // Get stored tokens to revoke them
    const tokenDoc = await adminDb
      .collection('user_youtube_tokens')
      .doc(userId)
      .get();

    if (tokenDoc.exists) {
      const tokenData = tokenDoc.data()!;
      
      if (tokenData.accessToken) {
        try {
          // Revoke the access token
          const accessToken = decrypt(tokenData.accessToken);
          await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
            method: 'POST',
          });
        } catch (revokeError) {
          console.warn('Failed to revoke token:', revokeError);
          // Continue with local cleanup even if revocation fails
        }
      }
    }

    // Delete stored tokens
    await adminDb
      .collection('user_youtube_tokens')
      .doc(userId)
      .delete();
      
  } catch (error) {
    console.error('Disconnect failed:', error);
    throw new Error('Failed to disconnect YouTube account');
  }
}