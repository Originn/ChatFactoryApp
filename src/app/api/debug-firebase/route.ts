import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get Firebase config from environment variables
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };

    // Analyze the API key
    const apiKey = firebaseConfig.apiKey || '';
    const analysis = {
      hasApiKey: !!apiKey,
      startsWithAIza: apiKey.startsWith('AIza'),
      length: apiKey.length,
      prefix: apiKey.substring(0, 10),
      suffix: apiKey.substring(apiKey.length - 4),
      isLikelyValid: apiKey.startsWith('AIza') && apiKey.length >= 35 && apiKey.length <= 45,
      isLikelyFake: apiKey.includes('dGVzdGJvdC00eW') || apiKey.includes('configured-via-api')
    };

    // Check if this looks like a fallback/fake key
    const status = analysis.isLikelyFake ? 'FAKE_KEY_DETECTED' :
                   analysis.isLikelyValid ? 'LIKELY_VALID' :
                   analysis.hasApiKey ? 'SUSPICIOUS' : 'MISSING';

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      status,
      firebaseConfig: {
        ...firebaseConfig,
        // Mask the API key for security (show only prefix/suffix)
        apiKey: apiKey ? `${analysis.prefix}...${analysis.suffix}` : 'MISSING'
      },
      analysis,
      recommendations: getRecommendations(status, analysis),
      fullApiKeyVisible: false,
      note: "For security, the full API key is masked. Check Vercel dashboard or Firebase console for the complete key."
    });

  } catch (error: any) {
    console.error('❌ Debug Firebase error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

function getRecommendations(status: string, analysis: any): string[] {
  const recommendations: string[] = [];

  switch (status) {
    case 'FAKE_KEY_DETECTED':
      recommendations.push('🚨 FAKE API KEY DETECTED - This will cause authentication failures');
      recommendations.push('🔧 Redeploy the chatbot to trigger proper API key retrieval');
      recommendations.push('🔍 Check deployment logs for Firebase config retrieval errors');
      break;
      
    case 'MISSING':
      recommendations.push('❌ No Firebase API key found in environment variables');
      recommendations.push('🔧 Check Vercel environment variable configuration');
      recommendations.push('🔍 Verify Firebase project was created successfully');
      break;
      
    case 'SUSPICIOUS':
      recommendations.push('⚠️ API key format looks suspicious');
      recommendations.push('🧪 Test authentication to verify if key works');
      recommendations.push('🔍 Compare with Firebase Console to verify correctness');
      break;
      
    case 'LIKELY_VALID':
      recommendations.push('✅ API key format looks correct');
      recommendations.push('🧪 Test user authentication to confirm functionality');
      recommendations.push('📊 Monitor for authentication errors in production');
      break;
  }

  return recommendations;
}

// Optional: Add a query parameter to show the full key (use with caution)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Only show full key if explicitly requested with a secret
    if (body.showFullKey && body.secret === 'debug-firebase-2024') {
      const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
      
      return NextResponse.json({
        success: true,
        fullApiKey: apiKey,
        length: apiKey.length,
        startsWithAIza: apiKey.startsWith('AIza'),
        timestamp: new Date().toISOString(),
        warning: "Full API key exposed - use only for debugging"
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid request or missing secret'
    }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
