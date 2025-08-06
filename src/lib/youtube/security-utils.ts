import { adminDb } from '@/lib/firebase/admin/index';
import { NextRequest } from 'next/server';

/**
 * Security utilities for YouTube OAuth endpoints
 * Implements rate limiting, abuse prevention, and monitoring
 */

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Maximum requests per window
  keyGenerator: (req: NextRequest) => string;  // How to identify clients
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * In-memory rate limiter with Firestore fallback for distributed systems
 */
class RateLimiter {
  private cache = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    
    // Clean up expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.resetTime) {
        this.cache.delete(key);
      }
    }
  }

  async checkLimit(req: NextRequest): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const key = this.config.keyGenerator(req);
    const now = Date.now();
    const resetTime = now + this.config.windowMs;

    // Get current entry
    let entry = this.cache.get(key);

    // Reset if window expired
    if (!entry || now > entry.resetTime) {
      entry = { count: 0, resetTime };
      this.cache.set(key, entry);
    }

    // Check if limit exceeded
    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // Increment counter
    entry.count++;
    this.cache.set(key, entry);

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }
}

/**
 * Rate limiters for different OAuth operations
 */
export const oauthInitiateRateLimit = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 OAuth initiations per 15 minutes per IP
  keyGenerator: (req) => {
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 
               req.headers.get('x-real-ip') || 'unknown';
    return `oauth-initiate:${ip}`;
  },
});

export const oauthCallbackRateLimit = new RateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 20, // 20 callback attempts per 5 minutes per IP
  keyGenerator: (req) => {
    const forwardedFor = req.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 
               req.headers.get('x-real-ip') || 'unknown';
    return `oauth-callback:${ip}`;
  },
});

export const oauthRefreshRateLimit = new RateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 30, // 30 refresh attempts per 5 minutes per user
  keyGenerator: (req) => {
    // Extract userId from request body or params
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId') || 'unknown';
    return `oauth-refresh:${userId}`;
  },
});

/**
 * Security monitoring and abuse detection
 */
export class SecurityMonitor {
  /**
   * Log suspicious activity
   */
  static async logSuspiciousActivity(
    type: 'rate_limit_exceeded' | 'invalid_state' | 'invalid_pkce' | 'token_abuse',
    details: {
      ip?: string;
      userId?: string;
      userAgent?: string;
      endpoint?: string;
      error?: string;
    }
  ) {
    try {
      const logEntry = {
        type,
        timestamp: new Date(),
        ip: details.ip || 'unknown',
        userId: details.userId || 'unknown',
        userAgent: details.userAgent || 'unknown',
        endpoint: details.endpoint || 'unknown',
        error: details.error || '',
        severity: this.getSeverity(type),
      };

      // Log to Firestore for persistence and analysis
      await adminDb.collection('security_logs').add(logEntry);
      
      // Also log to console for immediate visibility
      console.warn(`Security Alert [${type}]:`, logEntry);

      // Check for repeated violations
      await this.checkForAbuse(details.ip, details.userId, type);
      
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }

  private static getSeverity(type: string): 'low' | 'medium' | 'high' {
    switch (type) {
      case 'rate_limit_exceeded':
        return 'medium';
      case 'invalid_state':
      case 'invalid_pkce':
        return 'high';
      case 'token_abuse':
        return 'high';
      default:
        return 'low';
    }
  }

  private static async checkForAbuse(ip?: string, userId?: string, type?: string) {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Check for repeated violations from same IP
      if (ip && ip !== 'unknown') {
        const ipViolations = await adminDb
          .collection('security_logs')
          .where('ip', '==', ip)
          .where('timestamp', '>', oneHourAgo)
          .where('severity', '>=', 'medium')
          .get();

        if (ipViolations.size > 10) {
          console.error(`HIGH RISK: IP ${ip} has ${ipViolations.size} violations in the last hour`);
          // Could implement IP blocking here
        }
      }

      // Check for repeated violations from same user
      if (userId && userId !== 'unknown') {
        const userViolations = await adminDb
          .collection('security_logs')
          .where('userId', '==', userId)
          .where('timestamp', '>', oneHourAgo)
          .where('severity', '>=', 'medium')
          .get();

        if (userViolations.size > 5) {
          console.error(`HIGH RISK: User ${userId} has ${userViolations.size} violations in the last hour`);
          // Could implement user suspension here
        }
      }
    } catch (error) {
      console.error('Failed to check for abuse patterns:', error);
    }
  }
}

/**
 * Request validation utilities
 */
export class RequestValidator {
  /**
   * Validate and sanitize user ID
   */
  static validateUserId(userId: string | null): { valid: boolean; sanitized?: string; error?: string } {
    if (!userId) {
      return { valid: false, error: 'User ID is required' };
    }

    // Remove any non-alphanumeric characters except hyphens and underscores
    const sanitized = userId.replace(/[^a-zA-Z0-9\-_]/g, '');
    
    if (sanitized.length < 1 || sanitized.length > 128) {
      return { valid: false, error: 'User ID must be 1-128 characters' };
    }

    if (sanitized !== userId) {
      return { valid: false, error: 'User ID contains invalid characters' };
    }

    return { valid: true, sanitized };
  }

  /**
   * Validate OAuth state parameter
   */
  static validateState(state: string | null): { valid: boolean; error?: string } {
    if (!state) {
      return { valid: false, error: 'State parameter is required' };
    }

    // State should be hex string of specific length (64 chars for 32 bytes)
    if (!/^[a-f0-9]{64}$/i.test(state)) {
      return { valid: false, error: 'Invalid state parameter format' };
    }

    return { valid: true };
  }

  /**
   * Validate authorization code
   */
  static validateAuthCode(code: string | null): { valid: boolean; error?: string } {
    if (!code) {
      return { valid: false, error: 'Authorization code is required' };
    }

    // OAuth authorization codes are typically base64url encoded
    if (code.length < 20 || code.length > 512) {
      return { valid: false, error: 'Authorization code length invalid' };
    }

    // Check for suspicious patterns
    if (code.includes('<') || code.includes('>') || code.includes('"')) {
      return { valid: false, error: 'Authorization code contains invalid characters' };
    }

    return { valid: true };
  }

  /**
   * Extract client IP address safely
   */
  static getClientIP(req: NextRequest): string {
    const forwardedFor = req.headers.get('x-forwarded-for');
    if (forwardedFor) {
      // Take the first IP from the comma-separated list
      const ips = forwardedFor.split(',').map(ip => ip.trim());
      return ips[0] || 'unknown';
    }

    const realIP = req.headers.get('x-real-ip');
    if (realIP) {
      return realIP;
    }

    return 'unknown';
  }

  /**
   * Get safe user agent string
   */
  static getUserAgent(req: NextRequest): string {
    const userAgent = req.headers.get('user-agent') || 'unknown';
    // Truncate long user agents to prevent log spam
    return userAgent.length > 200 ? userAgent.substring(0, 200) + '...' : userAgent;
  }
}

/**
 * CSRF token validation for additional security
 */
export class CSRFProtection {
  /**
   * Generate CSRF token for OAuth state
   */
  static generateToken(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2);
    return `${timestamp}-${random}`;
  }

  /**
   * Validate CSRF token embedded in state
   */
  static validateToken(token: string): boolean {
    if (!token || !token.includes('-')) {
      return false;
    }

    const [timestampStr] = token.split('-');
    const timestamp = parseInt(timestampStr);
    
    if (isNaN(timestamp)) {
      return false;
    }

    // Token should not be older than 30 minutes
    const maxAge = 30 * 60 * 1000;
    return (Date.now() - timestamp) < maxAge;
  }
}