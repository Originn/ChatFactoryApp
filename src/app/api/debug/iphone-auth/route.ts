import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const timestamp = new Date().toISOString();
    
    // Log authentication attempt with device info
    console.log('📱 iPhone Auth Debug Log:', {
      timestamp,
      userAgent,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown',
      referer: request.headers.get('referer') || 'Unknown',
      ...body
    });
    
    return NextResponse.json({ 
      success: true, 
      logged: true,
      timestamp 
    });
  } catch (error) {
    console.error('❌ iPhone Auth Debug Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to log debug info' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') || 'Unknown';
  const timestamp = new Date().toISOString();
  
  console.log('🔍 iPhone Auth Debug GET:', {
    timestamp,
    userAgent,
    url: request.url,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown'
  });
  
  return NextResponse.json({ 
    message: 'iPhone auth debug endpoint',
    timestamp,
    userAgent
  });
}