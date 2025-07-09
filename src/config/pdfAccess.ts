// CONFIG: PDF Access Configuration
// This file contains configuration for PDF access expiration times

export const PDF_ACCESS_CONFIG = {
  // Public PDF access (1 year)
  PUBLIC_EXPIRATION_HOURS: 24 * 365,
  
  // Private PDF access (7 days - extended from 24 hours)
  PRIVATE_EXPIRATION_HOURS: 24 * 7,
  
  // For chatbot deployment access (if needed in the future)
  CHATBOT_ACCESS_EXPIRATION_HOURS: 24 * 30, // 30 days
  
  // Emergency/admin access (if needed)
  ADMIN_ACCESS_EXPIRATION_HOURS: 24 * 90, // 90 days
} as const;

// Helper function to get expiration time based on access type
export function getPDFExpirationHours(accessType: 'public' | 'private' | 'chatbot' | 'admin'): number {
  switch (accessType) {
    case 'public':
      return PDF_ACCESS_CONFIG.PUBLIC_EXPIRATION_HOURS;
    case 'private':
      return PDF_ACCESS_CONFIG.PRIVATE_EXPIRATION_HOURS;
    case 'chatbot':
      return PDF_ACCESS_CONFIG.CHATBOT_ACCESS_EXPIRATION_HOURS;
    case 'admin':
      return PDF_ACCESS_CONFIG.ADMIN_ACCESS_EXPIRATION_HOURS;
    default:
      return PDF_ACCESS_CONFIG.PRIVATE_EXPIRATION_HOURS;
  }
}

// Helper function to get human-readable expiration description
export function getExpirationDescription(accessType: 'public' | 'private' | 'chatbot' | 'admin'): string {
  switch (accessType) {
    case 'public':
      return '1 year';
    case 'private':
      return '7 days';
    case 'chatbot':
      return '30 days';
    case 'admin':
      return '90 days';
    default:
      return '7 days';
  }
}