import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase/admin/index';
import { 
  oauthCallbackRateLimit, 
  SecurityMonitor, 
  RequestValidator 
} from '@/lib/youtube/security-utils';

/**
 * Encrypt sensitive data for storage (fixed for modern Node.js)
 */
function encrypt(text: string): string {
  try {
    const key = process.env.YOUTUBE_KEYS_ENCRYPTION_KEY || 'your-32-character-secret-key-here!!';
    const iv = crypto.randomBytes(16);
    const keyBuffer = crypto.scryptSync(key, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt token');
  }
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
    `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true&key=${process.env.YOUTUBE_API_KEY}`,
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
    thumbnailUrl: channel.snippet.thumbnails.high?.url || 
                  channel.snippet.thumbnails.medium?.url || 
                  channel.snippet.thumbnails.default?.url,
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
      
      // For popup flow, return error HTML instead of redirect
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Connection Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #f8f9fa;
              color: #333;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .error-icon {
              font-size: 3rem;
              color: #ef4444;
              margin-bottom: 1rem;
            }
            h1 {
              margin: 0 0 0.5rem 0;
              color: #1f2937;
            }
            p {
              margin: 0;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">❌</div>
            <h1>Connection Failed</h1>
            <p>You can close this window and try again.</p>
          </div>
          <script>
            // Notify parent window of error
            if (window.opener) {
              window.opener.postMessage({
                type: 'youtube_oauth_error',
                error: '${error.replace(/'/g, "\\'")}'
              }, window.location.origin);
            }
            // Auto-close after 3 seconds
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
        </body>
        </html>
      `, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      });
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

      // Try to determine flow type from session data
      let isPopupFlow = true; // Default to popup for safety
      
      if (state) {
        try {
          const tempSessionDoc = await adminDb
            .collection('youtube_oauth_sessions')
            .doc(state)
            .get();
          
          if (tempSessionDoc.exists) {
            const tempSessionData = tempSessionDoc.data()!;
            isPopupFlow = !tempSessionData.redirectUrl;
          }
        } catch (error) {
          // If we can't determine, default to popup
        }
      }
      
      if (isPopupFlow) {
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head><title>Invalid Parameters</title></head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'youtube_oauth_error',
                  error: 'Invalid authorization parameters'
                }, window.location.origin);
              }
              window.close();
            </script>
          </body>
          </html>
        `, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      } else {
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?youtube_error=${encodeURIComponent('Invalid authorization parameters')}`
        );
      }
    }

    // Retrieve and validate OAuth session
    const sessionDoc = await adminDb
      .collection('youtube_oauth_sessions')
      .doc(state)
      .get();

    if (!sessionDoc.exists) {
      console.error('Invalid or expired OAuth state:', state);
      
      // Return popup error for desktop users
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head><title>Session Expired</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'youtube_oauth_error',
                error: 'Invalid or expired authentication session'
              }, window.location.origin);
            }
            window.close();
          </script>
        </body>
        </html>
      `, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    const sessionData = sessionDoc.data()!;
    
    // Validate session hasn't expired
    if (new Date() > sessionData.expiresAt.toDate()) {
      console.error('OAuth session expired for state:', state);
      await adminDb.collection('youtube_oauth_sessions').doc(state).delete();
      
      if (!sessionData.redirectUrl) {
        // Popup flow
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head><title>Session Expired</title></head>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'youtube_oauth_error',
                  error: 'Authentication session expired'
                }, window.location.origin);
              }
              window.close();
            </script>
          </body>
          </html>
        `, {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      } else {
        // Redirect flow
        const originalUrl = sessionData.redirectUrl;
        const separator = originalUrl.includes('?') ? '&' : '?';
        return NextResponse.redirect(
          `${process.env.NEXT_PUBLIC_APP_URL}${originalUrl}${separator}youtube_error=${encodeURIComponent('Authentication session expired')}`
        );
      }
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

    // Check if this is a popup flow (no redirectUrl means desktop popup)
    if (!sessionData.redirectUrl) {
      // Desktop popup flow - return HTML that communicates with parent window
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>YouTube Connected</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #f8f9fa;
              color: #333;
            }
            .container {
              text-align: center;
              padding: 2rem;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .success-icon {
              font-size: 3rem;
              color: #22c55e;
              margin-bottom: 1rem;
            }
            h1 {
              margin: 0 0 0.5rem 0;
              color: #1f2937;
            }
            p {
              margin: 0;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>YouTube Connected!</h1>
            <p>You can close this window now.</p>
          </div>
          <script>
            // Notify parent window of success
            if (window.opener) {
              window.opener.postMessage({
                type: 'youtube_oauth_success',
                data: { success: true }
              }, window.location.origin);
            }
            // Auto-close after 2 seconds
            setTimeout(() => {
              window.close();
            }, 2000);
          </script>
        </body>
        </html>
      `, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      });
    } else {
      // Mobile redirect flow - redirect back to the original page
      const originalUrl = sessionData.redirectUrl;
      const separator = originalUrl.includes('?') ? '&' : '?';
      
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}${originalUrl}${separator}youtube_success=true`
      );
    }

  } catch (error) {
    console.error('OAuth callback error:', error);
    
    // Clean up session if state is available
    const { searchParams } = new URL(req.url);
    const state = searchParams.get('state');
    let isPopupFlow = true; // Default to popup for safety
    
    if (state) {
      try {
        const sessionDoc = await adminDb.collection('youtube_oauth_sessions').doc(state).get();
        if (sessionDoc.exists) {
          const sessionData = sessionDoc.data()!;
          isPopupFlow = !sessionData.redirectUrl;
        }
        await adminDb.collection('youtube_oauth_sessions').doc(state).delete();
      } catch (cleanupError) {
        console.error('Failed to clean up OAuth session:', cleanupError);
      }
    }

    if (isPopupFlow) {
      // Popup flow error
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head><title>Authentication Failed</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'youtube_oauth_error',
                error: 'Authentication failed'
              }, window.location.origin);
            }
            window.close();
          </script>
        </body>
        </html>
      `, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    } else {
      // Redirect flow error
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?youtube_error=${encodeURIComponent('Authentication failed')}`
      );
    }
  }
}