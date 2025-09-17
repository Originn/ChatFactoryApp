import { NextRequest, NextResponse } from 'next/server';
import {
  getClientIP,
  isIPWhitelisted,
  isEmailWhitelisted,
  generateBypassToken,
  getBypassStatus
} from '@/lib/bypass';

/**
 * Bypass Check API
 * ================
 *
 * Handles bypass validation for coming soon mode.
 * Supports both IP-based and user-based bypass checking.
 */

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Bypass check requested');

    const bypassStatus = getBypassStatus(request);

    return NextResponse.json({
      success: true,
      bypass: bypassStatus
    });

  } catch (error) {
    console.error('❌ Bypass check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, action } = body;

    console.log('🔐 Bypass authentication requested:', { email, action });

    if (action === 'check-user') {
      // Check if user email is whitelisted
      if (!email) {
        return NextResponse.json(
          { error: 'Email required' },
          { status: 400 }
        );
      }

      const isWhitelisted = isEmailWhitelisted(email);
      const ip = getClientIP(request);

      if (isWhitelisted) {
        // Generate bypass token for user
        const token = generateBypassToken({
          email: email,
          type: 'user'
        });

        if (token) {
          const response = NextResponse.json({
            success: true,
            bypass: true,
            reason: 'User email whitelisted',
            email: email
          });

          // Set secure httpOnly cookie
          response.cookies.set('bypass-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: '/'
          });

          console.log('✅ Bypass token set for user:', email);
          return response;
        }
      }

      return NextResponse.json({
        success: true,
        bypass: false,
        reason: 'User not whitelisted',
        email: email
      });
    }

    if (action === 'check-ip') {
      // Check IP bypass and set token if whitelisted
      const ip = getClientIP(request);
      const isWhitelisted = isIPWhitelisted(ip);

      if (isWhitelisted) {
        const token = generateBypassToken({
          ip: ip,
          type: 'ip'
        });

        if (token) {
          const response = NextResponse.json({
            success: true,
            bypass: true,
            reason: 'IP whitelisted',
            ip: ip
          });

          response.cookies.set('bypass-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: '/'
          });

          console.log('✅ Bypass token set for IP:', ip);
          return response;
        }
      }

      return NextResponse.json({
        success: true,
        bypass: false,
        reason: 'IP not whitelisted',
        ip: ip
      });
    }

    if (action === 'clear-bypass') {
      // Clear bypass token
      const response = NextResponse.json({
        success: true,
        message: 'Bypass cleared'
      });

      response.cookies.set('bypass-token', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 0,
        path: '/'
      });

      console.log('🧹 Bypass token cleared');
      return response;
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('❌ Bypass check POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}