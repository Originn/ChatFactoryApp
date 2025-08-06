import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase/admin/index';

/**
 * Decrypt stored tokens
 */
function decrypt(text: string): string {
  const key = process.env.YOUTUBE_KEYS_ENCRYPTION_KEY || 'your-32-character-secret-key-here!!';
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = textParts.join(':');
  const keyBuffer = crypto.scryptSync(key, 'salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Encrypt tokens for storage
 */
function encrypt(text: string): string {
  const key = process.env.YOUTUBE_KEYS_ENCRYPTION_KEY || 'your-32-character-secret-key-here!!';
  const iv = crypto.randomBytes(16);
  const keyBuffer = crypto.scryptSync(key, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('YouTube OAuth credentials not configured');
  }

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

  return response.json();
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Get stored tokens
    const tokenDoc = await adminDb
      .collection('user_youtube_tokens')
      .doc(userId)
      .get();

    if (!tokenDoc.exists) {
      return NextResponse.json(
        { error: 'No YouTube tokens found for user' },
        { status: 404 }
      );
    }

    const tokenData = tokenDoc.data()!;
    
    if (!tokenData.refreshToken) {
      return NextResponse.json(
        { error: 'No refresh token available' },
        { status: 400 }
      );
    }

    // Decrypt refresh token
    const refreshToken = decrypt(tokenData.refreshToken);

    // Refresh the access token
    const newTokens = await refreshAccessToken(refreshToken);

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

    return NextResponse.json({
      success: true,
      expiresIn: newTokens.expires_in,
      message: 'Token refreshed successfully',
    });

  } catch (error) {
    console.error('Error refreshing YouTube token:', error);
    
    // If refresh fails, the tokens may be invalid
    if (error instanceof Error && error.message.includes('Failed to refresh')) {
      return NextResponse.json(
        { 
          error: 'Token refresh failed',
          requiresReauth: true,
          message: 'Please reconnect your YouTube account',
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error during token refresh' },
      { status: 500 }
    );
  }
}

/**
 * Check if token needs refresh and automatically refresh if needed
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Get stored tokens
    const tokenDoc = await adminDb
      .collection('user_youtube_tokens')
      .doc(userId)
      .get();

    if (!tokenDoc.exists) {
      return NextResponse.json(
        { error: 'No YouTube tokens found for user' },
        { status: 404 }
      );
    }

    const tokenData = tokenDoc.data()!;
    
    // Check if token is close to expiring (within 5 minutes)
    const connectedAt = tokenData.connectedAt.toDate();
    const lastRefreshed = tokenData.refreshedAt?.toDate() || connectedAt;
    const expiresAt = new Date(lastRefreshed.getTime() + (tokenData.expiresIn * 1000));
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);

    const needsRefresh = expiresAt < fiveMinutesFromNow;

    return NextResponse.json({
      needsRefresh,
      expiresAt: expiresAt.toISOString(),
      lastRefreshed: lastRefreshed.toISOString(),
    });

  } catch (error) {
    console.error('Error checking token status:', error);
    return NextResponse.json(
      { error: 'Failed to check token status' },
      { status: 500 }
    );
  }
}