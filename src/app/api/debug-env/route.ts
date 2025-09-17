import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const envVars = {
    NEXT_PUBLIC_COMING_SOON: process.env.NEXT_PUBLIC_COMING_SOON,
    ADMIN_BYPASS_IPS: process.env.ADMIN_BYPASS_IPS,
    ADMIN_BYPASS_EMAILS: process.env.ADMIN_BYPASS_EMAILS,
    BYPASS_SECRET_KEY: process.env.BYPASS_SECRET_KEY ? 'SET' : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV
  };

  console.log('🔍 Environment Variables Debug:', envVars);

  return NextResponse.json({
    success: true,
    environment: envVars,
    timestamp: new Date().toISOString()
  });
}