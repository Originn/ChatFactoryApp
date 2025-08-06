import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase/admin/index';
import { 
  oauthCallbackRateLimit, 
  SecurityMonitor, 
  RequestValidator 
} from '@/lib/youtube/security-utils';

/**
 * Encrypt sensitive data for storage
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
 * Exchange authorization code for access tokens using PKCE
 */
async function exchangeCodeForTokens(
  code: string, 
  codeVerifier: string,
  redirectUri: string
) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('YouTube OAuth credentials not configured');
  }

  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code_verifier: codeVerifier, // PKCE verification
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams.toString(),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('Token exchange failed:', { status: response.status, error: errorData });
    throw new Error('Failed to exchange authorization code for tokens');
  }

  return response.json();
}

/**
 * Fetch YouTube channel information
 */
async function getChannelInfo(accessToken: string) {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    console.warn('Failed to fetch channel info:', response.status);
    return null;
  }

  const data = await response.json();
  if (!data.items || data.items.length === 0) {
    return null;
  }

  const channel = data.items[0];
  return {
    id: channel.id,
    title: channel.snippet.title,
    description: channel.snippet.description,
    thumbnailUrl: channel.snippet.thumbnails?.default?.url,
    subscriberCount: channel.statistics?.subscriberCount,
  };
}

export async function GET(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await oauthCallbackRateLimit.checkLimit(req);
    if (!rateLimitResult.allowed) {
      await SecurityMonitor.logSuspiciousActivity('rate_limit_exceeded', {
        ip: RequestValidator.getClientIP(req),
        userAgent: RequestValidator.getUserAgent(req),
        endpoint: '/api/youtube/oauth/callback',
      });

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?youtube_error=${encodeURIComponent('Too many requests. Please try again later.')}`
      );
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      await SecurityMonitor.logSuspiciousActivity('invalid_state', {
        ip: RequestValidator.getClientIP(req),
        userAgent: RequestValidator.getUserAgent(req),
        endpoint: '/api/youtube/oauth/callback',
        error: `OAuth error: ${error}`,
      });

      console.error('OAuth error:', error);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?youtube_error=${encodeURIComponent(error)}`
      );
    }

    // Validate required parameters
    const codeValidation = RequestValidator.validateAuthCode(code);
    const stateValidation = RequestValidator.validateState(state);

    if (!codeValidation.valid || !stateValidation.valid) {
      await SecurityMonitor.logSuspiciousActivity('invalid_state', {
        ip: RequestValidator.getClientIP(req),
        userAgent: RequestValidator.getUserAgent(req),
        endpoint: '/api/youtube/oauth/callback',
        error: `Invalid parameters: ${codeValidation.error || stateValidation.error}`,
      });

      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?youtube_error=${encodeURIComponent('Invalid authorization parameters')}`
      );
    }

    // Retrieve and validate OAuth session
    const sessionDoc = await adminDb
      .collection('youtube_oauth_sessions')
      .doc(state)
      .get();

    if (!sessionDoc.exists) {
      console.error('Invalid or expired OAuth state:', state);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?youtube_error=${encodeURIComponent('Invalid or expired authentication session')}`
      );
    }

    const sessionData = sessionDoc.data()!;
    
    // Validate session hasn't expired
    if (new Date() > sessionData.expiresAt.toDate()) {
      console.error('OAuth session expired for state:', state);
      await adminDb.collection('youtube_oauth_sessions').doc(state).delete();
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?youtube_error=${encodeURIComponent('Authentication session expired')}`
      );
    }

    // Exchange code for tokens using PKCE
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube/oauth/callback`;
    const tokens = await exchangeCodeForTokens(code, sessionData.codeVerifier, redirectUri);

    // Get channel information
    const channelInfo = await getChannelInfo(tokens.access_token);

    // Store encrypted tokens
    const tokenData = {
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token || ''),
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type,
      scope: tokens.scope,
      channelInfo,
      connectedAt: new Date(),
      lastUsed: new Date(),
    };

    await adminDb
      .collection('user_youtube_tokens')
      .doc(sessionData.userId)
      .set(tokenData);

    // Clean up OAuth session
    await adminDb.collection('youtube_oauth_sessions').doc(state).delete();

    // Redirect to success page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?youtube_success=true`
    );

  } catch (error) {
    console.error('OAuth callback error:', error);
    
    // Clean up session if state is available
    const { searchParams } = new URL(req.url);
    const state = searchParams.get('state');
    if (state) {
      try {
        await adminDb.collection('youtube_oauth_sessions').doc(state).delete();
      } catch (cleanupError) {
        console.error('Failed to clean up OAuth session:', cleanupError);
      }
    }

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?youtube_error=${encodeURIComponent('Authentication failed')}`
    );
  }
}