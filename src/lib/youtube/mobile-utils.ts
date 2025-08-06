/**
 * Mobile detection and platform-specific utilities for YouTube OAuth
 * Optimizes user experience across different devices and browsers
 */

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  platform: 'ios' | 'android' | 'windows' | 'macos' | 'linux' | 'unknown';
  browser: 'chrome' | 'safari' | 'firefox' | 'edge' | 'opera' | 'unknown';
  supportsCustomTabs: boolean;
  supportsWebAuth: boolean;
  recommendedFlow: 'redirect' | 'popup' | 'webauth';
}

/**
 * Detect device and browser capabilities from user agent
 */
export function detectDevice(userAgent?: string): DeviceInfo {
  const ua = userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  
  // Mobile detection
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobile = mobileRegex.test(ua);
  
  // Tablet detection (more specific)
  const tabletRegex = /iPad|Android(?=.*Mobile)|Tablet/i;
  const isTablet = tabletRegex.test(ua) && !ua.includes('Mobile');
  
  // Platform detection
  let platform: DeviceInfo['platform'] = 'unknown';
  if (/iPhone|iPad|iPod/.test(ua)) {
    platform = 'ios';
  } else if (/Android/.test(ua)) {
    platform = 'android';
  } else if (/Windows/.test(ua)) {
    platform = 'windows';
  } else if (/Mac OS X/.test(ua)) {
    platform = 'macos';
  } else if (/Linux/.test(ua)) {
    platform = 'linux';
  }

  // Browser detection
  let browser: DeviceInfo['browser'] = 'unknown';
  if (/Chrome/.test(ua) && !/Edge|OPR/.test(ua)) {
    browser = 'chrome';
  } else if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
    browser = 'safari';
  } else if (/Firefox/.test(ua)) {
    browser = 'firefox';
  } else if (/Edge/.test(ua)) {
    browser = 'edge';
  } else if (/OPR/.test(ua)) {
    browser = 'opera';
  }

  // Feature detection
  const supportsCustomTabs = platform === 'android' && browser === 'chrome';
  const supportsWebAuth = 'navigator' in globalThis && 'credentials' in navigator;

  // Determine recommended OAuth flow
  let recommendedFlow: DeviceInfo['recommendedFlow'] = 'redirect';
  if (supportsWebAuth && !isMobile) {
    recommendedFlow = 'webauth';
  } else if (isMobile || isTablet) {
    recommendedFlow = 'redirect'; // Always redirect on mobile for reliability
  } else if (browser === 'chrome' || browser === 'firefox') {
    recommendedFlow = 'redirect'; // Redirect is more reliable than popup
  }

  return {
    isMobile: isMobile && !isTablet,
    isTablet,
    isDesktop: !isMobile && !isTablet,
    platform,
    browser,
    supportsCustomTabs,
    supportsWebAuth,
    recommendedFlow,
  };
}

/**
 * Get platform-specific redirect URI optimizations
 */
export function getOptimizedRedirectUri(deviceInfo: DeviceInfo, baseUrl: string): string {
  const callbackPath = '/api/youtube/oauth/callback';
  
  // For mobile apps with custom schemes, you might want to use a custom URI
  // For web apps, always use HTTPS callback
  if (deviceInfo.platform === 'ios' && deviceInfo.isMobile) {
    // iOS-specific optimizations could go here
    return `${baseUrl}${callbackPath}`;
  }
  
  if (deviceInfo.platform === 'android' && deviceInfo.isMobile) {
    // Android-specific optimizations could go here
    return `${baseUrl}${callbackPath}`;
  }
  
  return `${baseUrl}${callbackPath}`;
}

/**
 * Get platform-specific OAuth parameters
 */
export function getOAuthParams(deviceInfo: DeviceInfo, baseParams: Record<string, string>): Record<string, string> {
  const params = { ...baseParams };
  
  // Mobile-specific parameters
  if (deviceInfo.isMobile || deviceInfo.isTablet) {
    // Force consent on mobile to ensure refresh token
    params.prompt = 'consent';
    
    // Mobile-optimized display
    if (deviceInfo.platform === 'ios') {
      params.display = 'touch';
    } else if (deviceInfo.platform === 'android') {
      params.display = 'touch';
    }
  }
  
  return params;
}

/**
 * Mobile-specific error messages and guidance
 */
export function getMobileErrorGuidance(error: string, deviceInfo: DeviceInfo): {
  message: string;
  actionText?: string;
  action?: () => void;
} {
  const baseMessage = error;
  
  if (deviceInfo.isMobile || deviceInfo.isTablet) {
    switch (error) {
      case 'popup_blocked':
        return {
          message: 'Please allow redirects in your browser settings.',
          actionText: 'Try Again',
        };
        
      case 'network_error':
        return {
          message: 'Connection issue. Please check your internet connection and try again.',
          actionText: 'Retry',
        };
        
      case 'access_denied':
        if (deviceInfo.platform === 'ios') {
          return {
            message: 'Access denied. Please ensure you\'re signed in to your Google account in Safari.',
            actionText: 'Open Settings',
          };
        } else if (deviceInfo.platform === 'android') {
          return {
            message: 'Access denied. Please ensure you\'re signed in to your Google account.',
            actionText: 'Try Again',
          };
        }
        break;
        
      default:
        return {
          message: `${baseMessage}. Please try again or use a different browser.`,
          actionText: 'Retry',
        };
    }
  }
  
  return { message: baseMessage };
}

/**
 * Check if browser supports modern features
 */
export function checkBrowserSupport(deviceInfo: DeviceInfo): {
  supported: boolean;
  warnings: string[];
  recommendations: string[];
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  let supported = true;
  
  // Check for very old browsers
  if (deviceInfo.browser === 'unknown') {
    warnings.push('Browser not recognized - some features may not work properly');
    recommendations.push('Please use Chrome, Safari, Firefox, or Edge for the best experience');
  }
  
  // iOS-specific checks
  if (deviceInfo.platform === 'ios') {
    // iOS Safari has specific requirements
    if (deviceInfo.browser !== 'safari' && deviceInfo.browser !== 'chrome') {
      warnings.push('For the best experience on iOS, use Safari or Chrome');
    }
  }
  
  // Android-specific checks
  if (deviceInfo.platform === 'android') {
    if (deviceInfo.browser === 'unknown') {
      recommendations.push('Use Chrome or Firefox for the best experience on Android');
    }
  }
  
  // Feature detection warnings
  if (!deviceInfo.supportsWebAuth && deviceInfo.isDesktop) {
    warnings.push('Your browser may not support the latest authentication features');
  }
  
  return {
    supported,
    warnings,
    recommendations,
  };
}

/**
 * Generate deep link for mobile apps (if applicable)
 */
export function generateMobileDeepLink(
  deviceInfo: DeviceInfo, 
  authUrl: string, 
  fallbackUrl: string
): string {
  // For web-based OAuth, we typically don't use deep links
  // But this could be extended for hybrid mobile apps
  
  if (deviceInfo.platform === 'ios' && deviceInfo.isMobile) {
    // Could implement iOS Universal Links here
    return authUrl;
  }
  
  if (deviceInfo.platform === 'android' && deviceInfo.isMobile) {
    // Could implement Android App Links here
    return authUrl;
  }
  
  return authUrl;
}

/**
 * Handle mobile-specific redirect behavior
 */
export function handleMobileRedirect(url: string, deviceInfo: DeviceInfo): void {
  if (typeof window === 'undefined') return;
  
  if (deviceInfo.isMobile || deviceInfo.isTablet) {
    // On mobile, always use location.href for better compatibility
    window.location.href = url;
  } else {
    // On desktop, location.href is still most reliable
    window.location.href = url;
  }
}

/**
 * Mobile-optimized viewport and UI considerations
 */
export function getMobileUIConfig(deviceInfo: DeviceInfo) {
  return {
    // Button sizing
    buttonSize: deviceInfo.isMobile ? 'lg' : 'md',
    buttonClass: deviceInfo.isMobile ? 'min-h-[48px] text-base' : 'min-h-[40px] text-sm',
    
    // Spacing
    spacing: deviceInfo.isMobile ? 'p-6 space-y-6' : 'p-4 space-y-4',
    
    // Card sizing
    cardClass: deviceInfo.isMobile 
      ? 'w-full max-w-sm mx-auto' 
      : 'w-full max-w-md mx-auto',
      
    // Text sizing
    titleSize: deviceInfo.isMobile ? 'text-xl' : 'text-lg',
    bodySize: deviceInfo.isMobile ? 'text-base' : 'text-sm',
    
    // Touch targets
    touchTarget: deviceInfo.isMobile ? 'min-w-[44px] min-h-[44px]' : '',
    
    // Loading states
    showProgressIndicator: deviceInfo.isMobile, // Mobile users expect more feedback
  };
}