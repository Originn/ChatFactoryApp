import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const isRedirect = searchParams.get('redirect') === 'true';

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    
    if (!clientId) {
      return NextResponse.json(
        { error: 'YouTube API credentials not configured' },
        { status: 500 }
      );
    }

    // youtube.force-ssl scope is required for caption/transcript download
    // youtube.readonly is insufficient for captions.download API endpoint
    const scope = 'https://www.googleapis.com/auth/youtube.force-ssl';
    
    // Add redirect parameter to callback URL for redirect flow
    const callbackUrl = new URL(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/youtube/callback`);
    if (isRedirect) {
      callbackUrl.searchParams.set('redirect', 'true');
    }
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl.toString(),
      response_type: 'code',
      scope: scope,
      access_type: 'offline',
      prompt: 'consent',
      state: userId // Pass userId through state parameter
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}