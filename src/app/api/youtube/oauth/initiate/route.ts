import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase/admin/index';
import { 
  oauthInitiateRateLimit, 
  SecurityMonitor, 
  RequestValidator 
} from '@/lib/youtube/security-utils';

/**
 * Generate PKCE code verifier and challenge
 * Following RFC 7636 specifications
 */
function generatePKCE() {
  // Generate 128 bytes of random data and encode as base64url
  const codeVerifier = crypto.randomBytes(128).toString('base64url');
  
  // Create SHA256 hash and encode as base64url
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
    
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256'
  };
}

/**
 * Generate cryptographically secure state parameter
 */
function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await oauthInitiateRateLimit.checkLimit(req);
    if (!rateLimitResult.allowed) {
      await SecurityMonitor.logSuspiciousActivity('rate_limit_exceeded', {
        ip: RequestValidator.getClientIP(req),
        userAgent: RequestValidator.getUserAgent(req),
        endpoint: '/api/youtube/oauth/initiate',
      });

      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString(),
          }
        }
      );
    }

    const { userId, redirectUrl } = await req.json();

    // Validate and sanitize userId
    const userIdValidation = RequestValidator.validateUserId(userId);
    if (!userIdValidation.valid) {
      await SecurityMonitor.logSuspiciousActivity('invalid_state', {
        ip: RequestValidator.getClientIP(req),
        userId: userId,
        userAgent: RequestValidator.getUserAgent(req),
        endpoint: '/api/youtube/oauth/initiate',
        error: userIdValidation.error,
      });

      return NextResponse.json(
        { error: userIdValidation.error },
        { status: 400 }
      );
    }

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: 'YouTube OAuth not configured' },
        { status: 500 }
      );
    }

    // Generate PKCE parameters
    const { codeVerifier, codeChallenge, codeChallengeMethod } = generatePKCE();
    
    // Generate state parameter for CSRF protection
    const state = generateState();
    
    // Validate and sanitize redirect URL if provided (only for mobile redirect flow)
    let sanitizedRedirectUrl: string | undefined = undefined;
    if (redirectUrl) {
      try {
        const parsedUrl = new URL(redirectUrl);
        
        // Security check: Only allow same-origin redirects
        if (parsedUrl.origin === process.env.NEXT_PUBLIC_APP_URL) {
          sanitizedRedirectUrl = parsedUrl.pathname + parsedUrl.search + parsedUrl.hash;
          console.log('OAuth: Storing redirect URL:', sanitizedRedirectUrl); // Debug log
        } else {
          console.warn('OAuth: Rejected cross-origin redirect URL:', redirectUrl);
        }
      } catch (error) {
        console.warn('OAuth: Invalid redirect URL provided:', redirectUrl, error);
      }
    }
    
    console.log('OAuth: Final redirect URL (undefined means popup flow):', sanitizedRedirectUrl); // Debug log

    // Store PKCE verifier and state temporarily (expires in 10 minutes)
    const oauthSession = {
      userId: userIdValidation.sanitized!,
      codeVerifier,
      state,
      ...(sanitizedRedirectUrl && { redirectUrl: sanitizedRedirectUrl }), // Only store if provided (popup vs redirect)
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      clientIP: RequestValidator.getClientIP(req),
      userAgent: RequestValidator.getUserAgent(req),
    };

    await adminDb
      .collection('youtube_oauth_sessions')
      .doc(state)
      .set(oauthSession);

    // Build OAuth URL with PKCE parameters
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube/oauth/callback`;
    
    const oauthParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/youtube.force-ssl',
      access_type: 'offline',
      prompt: 'consent', // Force consent to get refresh token
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${oauthParams.toString()}`;

    return NextResponse.json({
      authUrl,
      state, // Return state for frontend tracking
    });

  } catch (error) {
    console.error('Error initiating YouTube OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}