import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { verify, sign } from 'jsonwebtoken';

/**
 * Bypass Utility Functions
 * ========================
 *
 * Handles IP-based and user-based bypass for coming soon mode.
 * Provides secure token management and validation.
 */

export interface BypassToken {
  ip?: string;
  email?: string;
  timestamp: number;
  type: 'ip' | 'user';
}

/**
 * Extract real IP address from request, handling proxies and CDNs
 */
export function getClientIP(request: NextRequest): string {
  // Check various headers for real IP (in order of preference)
  const headers = [
    'x-real-ip',           // Nginx
    'x-forwarded-for',     // Standard proxy header
    'cf-connecting-ip',    // Cloudflare
    'x-client-ip',         // Alternative
    'x-forwarded',         // Alternative
    'forwarded-for',       // Alternative
    'forwarded',           // RFC 7239
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ip = value.split(',')[0].trim();
      if (isValidIP(ip)) {
        return ip;
      }
    }
  }

  // Fallback to connection IP
  return request.ip || 'unknown';
}

/**
 * Validate IP address format
 */
function isValidIP(ip: string): boolean {
  // IPv4 regex
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  // IPv6 regex (simplified)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Check if IP is in whitelist
 */
export function isIPWhitelisted(ip: string): boolean {
  const whitelistedIPs = process.env.ADMIN_BYPASS_IPS?.split(',').map(ip => ip.trim()) || [];

  // Normalize IPv6 localhost
  const normalizedIP = ip === '::1' ? '127.0.0.1' : ip;

  return whitelistedIPs.includes(normalizedIP) || whitelistedIPs.includes(ip);
}

/**
 * Check if email is in bypass list
 */
export function isEmailWhitelisted(email: string): boolean {
  const whitelistedEmails = process.env.ADMIN_BYPASS_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  return whitelistedEmails.includes(email.toLowerCase());
}

/**
 * Generate bypass token
 */
export function generateBypassToken(data: Omit<BypassToken, 'timestamp'>): string | null {
  const secret = process.env.BYPASS_SECRET_KEY;
  if (!secret) {
    console.error('BYPASS_SECRET_KEY not configured');
    return null;
  }

  const token: BypassToken = {
    ...data,
    timestamp: Date.now(),
  };

  try {
    return sign(token, secret, { expiresIn: '7d' });
  } catch (error) {
    console.error('Error generating bypass token:', error);
    return null;
  }
}

/**
 * Verify bypass token
 */
export function verifyBypassToken(token: string): BypassToken | null {
  const secret = process.env.BYPASS_SECRET_KEY;
  if (!secret) {
    console.error('BYPASS_SECRET_KEY not configured');
    return null;
  }

  try {
    const decoded = verify(token, secret) as BypassToken;

    // Check if token is not too old (7 days max)
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    if (Date.now() - decoded.timestamp > maxAge) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Error verifying bypass token:', error);
    return null;
  }
}

/**
 * Check if request should bypass coming soon (server-side)
 */
export function shouldBypassComingSoon(request: NextRequest): boolean {
  // If coming soon is not enabled, always allow
  if (process.env.NEXT_PUBLIC_COMING_SOON !== 'true') {
    return true;
  }

  // Check IP whitelist
  const clientIP = getClientIP(request);
  if (isIPWhitelisted(clientIP)) {
    console.log(`🟢 IP bypass granted for: ${clientIP}`);
    return true;
  }

  // Check bypass token in cookies
  const bypassToken = request.cookies.get('bypass-token')?.value;
  if (bypassToken) {
    const tokenData = verifyBypassToken(bypassToken);
    if (tokenData) {
      console.log(`🟢 Token bypass granted for: ${tokenData.type === 'ip' ? tokenData.ip : tokenData.email}`);
      return true;
    }
  }

  console.log(`🔴 Bypass denied for IP: ${clientIP}`);
  return false;
}

/**
 * Check if user should bypass coming soon (client-side helper)
 */
export function shouldUserBypassComingSoon(userEmail?: string): boolean {
  // If coming soon is not enabled, always allow
  if (process.env.NEXT_PUBLIC_COMING_SOON !== 'true') {
    return true;
  }

  // Check if user email is whitelisted
  if (userEmail && isEmailWhitelisted(userEmail)) {
    return true;
  }

  return false;
}

/**
 * Set bypass cookie (for API routes)
 */
export function setBypassCookie(response: Response, token: string): void {
  const cookieValue = `bypass-token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}; Path=/`;
  response.headers.set('Set-Cookie', cookieValue);
}

/**
 * Get bypass status for current request
 */
export function getBypassStatus(request: NextRequest): {
  canBypass: boolean;
  reason: string;
  ip: string;
} {
  const ip = getClientIP(request);

  if (process.env.NEXT_PUBLIC_COMING_SOON !== 'true') {
    return {
      canBypass: true,
      reason: 'Coming soon mode disabled',
      ip
    };
  }

  if (isIPWhitelisted(ip)) {
    return {
      canBypass: true,
      reason: 'IP whitelisted',
      ip
    };
  }

  const bypassToken = request.cookies.get('bypass-token')?.value;
  if (bypassToken) {
    const tokenData = verifyBypassToken(bypassToken);
    if (tokenData) {
      return {
        canBypass: true,
        reason: `Valid ${tokenData.type} bypass token`,
        ip
      };
    }
  }

  return {
    canBypass: false,
    reason: 'No valid bypass found',
    ip
  };
}