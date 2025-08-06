# YouTube OAuth Setup Guide

This guide will help you fix the `redirect_uri_mismatch` error when connecting to YouTube.

## The Problem

The error `Error 400: redirect_uri_mismatch` occurs when the redirect URI in your OAuth request doesn't match what's configured in your Google OAuth client.

## Solution Steps

### 1. Set Up Environment Variables

Add these required environment variables to your `.env.local` file (copy from `.env.example`):

```bash
# YouTube OAuth Configuration
YOUTUBE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=your-actual-client-secret
NEXT_PUBLIC_APP_URL=https://your-production-domain.com
```

### 2. Configure Google OAuth Client

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one)
3. Navigate to **APIs & Services** > **Credentials**
4. Find your OAuth 2.0 Client ID or create a new one
5. Click **Edit** on your OAuth client
6. In **Authorized redirect URIs**, add:
   - `http://localhost:3000/api/youtube/callback` (for development)
   - `https://your-actual-domain.com/api/youtube/callback` (for production)

### 3. Enable Required APIs

Make sure these APIs are enabled in Google Cloud Console:
1. **YouTube Data API v3**
2. **Google+ API** (legacy, but still required for OAuth)

### 4. Check Your Domain

The `NEXT_PUBLIC_APP_URL` environment variable must match exactly with:
- The domain where your app is deployed
- The redirect URI configured in Google OAuth client

## Common Issues

### Domain Mismatch
- ❌ `NEXT_PUBLIC_APP_URL=http://localhost:3000` but production is `https://chatfactory.ai`
- ✅ `NEXT_PUBLIC_APP_URL=https://chatfactory.ai` for production

### Missing Environment Variables
- ❌ `YOUTUBE_CLIENT_ID` not set
- ✅ All YouTube OAuth variables properly configured

### Incorrect Redirect URI
- ❌ Redirect URI: `https://example.com/callback` 
- ✅ Redirect URI: `https://example.com/api/youtube/callback`

## Testing

After configuration:
1. Restart your development server
2. Try connecting to YouTube again
3. Check browser network tab for the actual redirect URI being used
4. Verify it matches what's configured in Google OAuth client

## Production Deployment

For Vercel/production deployment:
1. Set environment variables in your hosting platform
2. Update `NEXT_PUBLIC_APP_URL` to your production domain
3. Add production redirect URI to Google OAuth client
4. Redeploy your application

## Contact

If you continue to have issues, check:
- Environment variables are properly set
- Google OAuth client configuration
- API quotas and limits
- Browser console for additional error details