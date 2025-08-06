import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Detect if the current device is mobile based on user agent
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }
  
  const userAgent = navigator.userAgent || navigator.vendor;
  
  // Check for mobile patterns in user agent
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
  return mobileRegex.test(userAgent);
}

/**
 * Check if popups are likely to be blocked (mobile or strict desktop browsers)
 */
export function isPopupLikelyBlocked(): boolean {
  // Always assume popups are blocked on mobile
  if (isMobileDevice()) {
    return true;
  }
  
  // For desktop, we'll try to detect but it's harder to know in advance
  return false;
}
