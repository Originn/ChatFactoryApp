import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state'); // userId

  // Always use redirect flow (COOP policy blocks popup communication)
  if (code || error) {
    // Redirect back to the page where the user initiated the connection
    // Default to dashboard if no stored redirect URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUrl = new URL(baseUrl + '/dashboard');
    
    if (error) {
      redirectUrl.searchParams.set('youtube_error', error);
    }
    if (code && state) {
      redirectUrl.searchParams.set('youtube_code', code);
      redirectUrl.searchParams.set('youtube_state', state);
    }
    
    return NextResponse.redirect(redirectUrl);
  }

  // Fallback for any unexpected cases (shouldn't happen with redirect flow)
  return NextResponse.json({ error: 'Invalid callback request' }, { status: 400 });
}