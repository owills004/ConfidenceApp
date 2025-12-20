
export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
  isDisposable?: boolean;
}

const COMMON_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'live.com', 'me.com'];
const DISPOSABLE_DOMAINS = ['mailinator.com', '10minutemail.com', 'tempmail.com', 'guerrillamail.com', 'trashmail.com'];

export const validateEmail = (email: string): EmailValidationResult => {
  const cleanEmail = email.trim().toLowerCase();
  
  if (!cleanEmail) {
    return { isValid: false, error: 'Email is required.' };
  }

  // 1. Format Check (Robust RFC-compliant-ish Regex)
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!regex.test(cleanEmail)) {
    return { isValid: false, error: 'Please enter a valid email format.' };
  }

  const [localPart, domain] = cleanEmail.split('@');

  // 2. Disposable Email Check
  if (DISPOSABLE_DOMAINS.includes(domain)) {
    return { 
      isValid: false, 
      error: 'Please use a permanent email address.', 
      isDisposable: true 
    };
  }

  // 3. Typo Suggestion (Simple Levenshtein-style or Common Mappings)
  const typos: Record<string, string> = {
    'gmial.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'yaho.com': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'outlok.com': 'outlook.com'
  };

  if (typos[domain]) {
    return { 
      isValid: true, 
      suggestion: `${localPart}@${typos[domain]}` 
    };
  }

  return { isValid: true };
};
