// Input validation and sanitization utilities

export class ValidationError extends Error {
  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
  field?: string;
}

// Email validation
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

// Password validation
export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Display name validation
export const validateDisplayName = (name: string): boolean => {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 50 && /^[a-zA-Z\s'-]+$/.test(trimmed);
};

// Sanitize string input (prevent XSS)
export const sanitizeString = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['"]/g, (match) => match === '"' ? '&quot;' : '&#39;') // Escape quotes
    .substring(0, 1000); // Limit length
};

// Sanitize user input object
export const sanitizeUserInput = (input: Record<string, any>): Record<string, any> => {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'boolean' || typeof value === 'number') {
      sanitized[key] = value;
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeUserInput(value);
    }
  }
  
  return sanitized;
};

// Form validation helper
export const validateSignupForm = (data: {
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!validateDisplayName(data.displayName)) {
    errors.push('Please enter a valid full name (2-50 characters, letters only)');
  }
  
  if (!validateEmail(data.email)) {
    errors.push('Please enter a valid email address');
  }
  
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.isValid) {
    errors.push(...passwordValidation.errors);
  }
  
  if (data.password !== data.confirmPassword) {
    errors.push('Passwords do not match');
  }
  
  if (!data.agreeToTerms) {
    errors.push('You must agree to the Terms of Service');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};
