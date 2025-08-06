import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state'); // userId
  const redirect = searchParams.get('redirect'); // Flag for redirect flow

  // For redirect flow, redirect back to the app with parameters
  if (redirect === 'true') {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUrl = new URL(baseUrl);
    
    if (error) {
      redirectUrl.searchParams.set('error', error);
    }
    if (code) {
      redirectUrl.searchParams.set('code', code);
    }
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }
    
    return NextResponse.redirect(redirectUrl);
  }

  // Return a simple HTML page that posts message to parent window (popup flow)
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>YouTube Authorization</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 2rem;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-left: 4px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 1rem;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner"></div>
          <h2>${error ? 'Authorization Failed' : 'Authorization Successful'}</h2>
          <p>${error ? 'Please try again.' : 'Connecting your YouTube account...'}</p>
        </div>
        <script>
          if (window.opener) {
            const errorParam = ${error ? `'${error}'` : 'null'};
            const codeParam = ${code ? `'${code}'` : 'null'};
            const stateParam = ${state ? `'${state}'` : 'null'};
            
            if (errorParam) {
              window.opener.postMessage({
                type: 'YOUTUBE_AUTH_ERROR',
                error: errorParam
              }, '${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}');
            } else if (codeParam && stateParam) {
              window.opener.postMessage({
                type: 'YOUTUBE_AUTH_SUCCESS',
                code: codeParam,
                userId: stateParam
              }, '${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}');
            } else {
              window.opener.postMessage({
                type: 'YOUTUBE_AUTH_ERROR',
                error: 'Missing authorization code or user ID'
              }, '${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}');
            }
          }
          setTimeout(() => {
            window.close();
          }, 2000);
        </script>
      </body>
    </html>
  `;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}