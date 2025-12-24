
export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  suggestion?: string;
  isDisposable?: boolean;
  domainReputation?: 'high' | 'medium' | 'low' | 'suspicious';
}

const COMMON_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 
  'live.com', 'me.com', 'protonmail.com', 'proton.me', 'aol.com', 
  'mail.com', 'zoho.com', 'yandex.com'
];

const DISPOSABLE_DOMAINS = [
  'mailinator.com', '10minutemail.com', 'tempmail.com', 'guerrillamail.com', 'trashmail.com',
  'yopmail.com', 'dispostable.com', 'sharklasers.com', 'getnada.com', 'owlymail.com',
  'evonax.com', 'is-not-a.net', 'temp-mail.org', 'fake-mail.com'
];

/**
 * Validates basic email format and checks for common typos
 */
export const validateEmailFormat = (email: string): EmailValidationResult => {
  const cleanEmail = email.trim().toLowerCase();
  
  if (!cleanEmail) {
    return { isValid: false, error: 'Email is required.' };
  }

  // RFC-compliant-ish Regex
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!regex.test(cleanEmail)) {
    return { isValid: false, error: 'Please enter a valid email format.' };
  }

  const [localPart, domain] = cleanEmail.split('@');

  // Typo Suggestion
  const typos: Record<string, string> = {
    'gmial.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'gmaill.com': 'gmail.com',
    'yaho.com': 'yahoo.com',
    'hotmial.com': 'hotmail.com',
    'outlok.com': 'outlook.com',
    'proton.com': 'protonmail.com'
  };

  if (typos[domain]) {
    return { 
      isValid: true, 
      suggestion: `${localPart}@${typos[domain]}` 
    };
  }

  return { isValid: true };
};

/**
 * Asynchronously verifies if a domain is reputable and likely to accept mail.
 * Now strictly enforces recognized domains as per requirements.
 */
export const verifyDomainReputation = async (email: string): Promise<EmailValidationResult> => {
  const formatCheck = validateEmailFormat(email);
  if (!formatCheck.isValid) return formatCheck;

  const domain = email.split('@')[1].toLowerCase();

  // Simulate network latency for "verification"
  await new Promise(resolve => setTimeout(resolve, 600));

  if (DISPOSABLE_DOMAINS.includes(domain)) {
    return {
      isValid: false,
      error: `The domain "${domain}" is a known disposable email provider. Please use a permanent address.`,
      isDisposable: true,
      domainReputation: 'suspicious'
    };
  }

  // Check if domain is in our recognized list
  const isCommon = COMMON_DOMAINS.includes(domain);
  const isLikelyEducational = domain.endsWith('.edu');
  const isLikelyGovernment = domain.endsWith('.gov');

  if (!isCommon && !isLikelyEducational && !isLikelyGovernment) {
      // Per user request: Mark unrecognized domains as invalid
      return { 
          isValid: false, 
          error: `The domain "${domain}" is not recognized. Please use a standard email provider like Gmail or Outlook.`,
          domainReputation: 'low' 
      };
  }

  return { 
      isValid: true, 
      domainReputation: 'high' 
  };
};

/**
 * Checks if email already exists in the simulated database
 */
export const checkAccountExists = (email: string): boolean => {
    const usersDbStr = localStorage.getItem('fluentflow_users_db');
    if (!usersDbStr) return false;
    const usersDb = JSON.parse(usersDbStr);
    return usersDb.some((u: any) => u.email.toLowerCase() === email.trim().toLowerCase());
};
