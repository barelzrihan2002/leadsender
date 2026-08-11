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
export declare function normalizePhoneNumber(phone: string | number, country: Country): string;
/**
 * Batch normalize phone numbers and return results
 */
export declare function normalizePhoneNumbers(phones: Array<{
    phone: string | number;
    name?: string;
}>, country: Country): NormalizeResult[];
