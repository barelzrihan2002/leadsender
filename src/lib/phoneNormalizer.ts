/**
 * Phone Number Normalizer
 * Converts various phone number formats to a standard international format
 */

export type Country = 'israel' | 'usa' | 'saudi' | 'international';

export interface NormalizeResult {
  original: string;
  normalized: string;
  changed: boolean;
}

/**
 * Normalize a phone number based on country
 */
export function normalizePhoneNumber(phone: string | number, country: Country): string {
  // Handle Excel scientific notation (e.g., 9.72509E+11)
  let phoneStr = String(phone);
  
  // If it's scientific notation, convert it
  if (phoneStr.includes('E+') || phoneStr.includes('e+')) {
    const num = Number(phone);
    phoneStr = String(Math.round(num));
  }
  
  // Clean the phone number - remove all non-digit characters except +
  let cleaned = phoneStr.trim().replace(/[^\d+]/g, '');
  
  // If no normalization needed
  if (country === 'international') {
    // Just remove + and return
    return cleaned.replace(/^\+/, '');
  }
  
  // Remove leading + if exists
  cleaned = cleaned.replace(/^\+/, '');
  
  switch (country) {
    case 'israel':
      return normalizeIsrael(cleaned);
    case 'usa':
      return normalizeUSA(cleaned);
    case 'saudi':
      return normalizeSaudi(cleaned);
    default:
      return cleaned;
  }
}

/**
 * Normalize Israeli phone numbers to 972XXXXXXXXX format
 */
function normalizeIsrael(phone: string): string {
  // Already in correct format (972XXXXXXXXX)
  if (phone.startsWith('972') && phone.length >= 12) {
    return phone;
  }
  
  // Format: 05XXXXXXXX (most common Israeli mobile format)
  if (phone.startsWith('05') && phone.length === 10) {
    return '9725' + phone.substring(2); // Replace 05 with 9725
  }
  
  // Format: 5XXXXXXXX (missing leading 0)
  if (phone.startsWith('5') && phone.length === 9) {
    return '972' + phone; // Add 972 prefix
  }
  
  // Format: 0XXXXXXXXX (any Israeli number with leading 0)
  if (phone.startsWith('0') && (phone.length === 10 || phone.length === 9)) {
    return '972' + phone.substring(1); // Replace 0 with 972
  }
  
  // If nothing matches, return as-is
  return phone;
}

/**
 * Normalize US phone numbers to 1XXXXXXXXXX format
 */
function normalizeUSA(phone: string): string {
  // Already in correct format (1XXXXXXXXXX)
  if (phone.startsWith('1') && phone.length === 11) {
    return phone;
  }
  
  // Format: XXXXXXXXXX (10 digits - standard US format without country code)
  if (phone.length === 10 && !phone.startsWith('1')) {
    return '1' + phone; // Add country code 1
  }
  
  // If nothing matches, return as-is
  return phone;
}

/**
 * Normalize Saudi phone numbers to 966XXXXXXXXX format
 */
function normalizeSaudi(phone: string): string {
  // Already in correct format (966XXXXXXXXX)
  if (phone.startsWith('966') && phone.length >= 12) {
    return phone;
  }
  
  // Format: 05XXXXXXXX (Saudi mobile format)
  if (phone.startsWith('05') && phone.length === 10) {
    return '9665' + phone.substring(2); // Replace 05 with 9665
  }
  
  // Format: 5XXXXXXXX (missing leading 0)
  if (phone.startsWith('5') && phone.length === 9) {
    return '966' + phone; // Add 966 prefix
  }
  
  // Format: 0XXXXXXXXX (Saudi number with leading 0)
  if (phone.startsWith('0') && phone.length === 10) {
    return '966' + phone.substring(1); // Replace 0 with 966
  }
  
  // If nothing matches, return as-is
  return phone;
}

/**
 * Batch normalize phone numbers and return results
 */
export function normalizePhoneNumbers(
  phones: Array<{ phone: string | number; name?: string }>,
  country: Country
): NormalizeResult[] {
  return phones.map(({ phone }) => {
    const original = String(phone);
    const normalized = normalizePhoneNumber(phone, country);
    
    return {
      original,
      normalized,
      changed: original !== normalized
    };
  });
}
