import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin/index';
import crypto from 'crypto';

// Encryption for storing user tokens
const ENCRYPTION_KEY = process.env.YOUTUBE_KEYS_ENCRYPTION_KEY || 'your-32-character-secret-key-here!!';

function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt token');
  }
}

export async function POST(req: NextRequest) {
  try {
    const { code, userId } = await req.json();

    if (!code || !userId) {
      return NextResponse.json(
        { error: 'Missing code or userId' },
        { status: 400 }
      );
    }

    // Use platform credentials from environment
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/youtube/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'YouTube API credentials not configured' },
        { status: 500 }
      );
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange failed:', { status: tokenResponse.status, error });
      return NextResponse.json(
        { error: 'Failed to exchange authorization code' },
        { status: 400 }
      );
    }

    const tokens = await tokenResponse.json();

    // Get user's channel info
    let channelInfo = null;
    try {
      const channelResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true&key=${process.env.YOUTUBE_API_KEY}`,
        {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`
          }
        }
      );

      if (channelResponse.ok) {
        const channelData = await channelResponse.json();
        if (channelData.items && channelData.items.length > 0) {
          const channel = channelData.items[0];
          channelInfo = {
            id: channel.id,
            title: channel.snippet.title,
            description: channel.snippet.description,
            thumbnailUrl: channel.snippet.thumbnails.default?.url,
            subscriberCount: channel.statistics?.subscriberCount
          };
        }
      }
    } catch (error) {
      console.error('Failed to fetch channel info:', error);
    }

    // Store encrypted tokens in Firestore
    const userTokenData = {
      accessToken: encrypt(tokens.access_token),
      refreshToken: encrypt(tokens.refresh_token || ''),
      expiresIn: tokens.expires_in,
      channelInfo,
      connectedAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };

    await adminDb.collection('user_youtube_tokens').doc(userId).set(userTokenData);

    return NextResponse.json({
      success: true,
      channelInfo,
      message: 'YouTube account connected successfully'
    });
  } catch (error) {
    console.error('Error in token exchange:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}