/**
 * Client-side driver search validation (step 1).
 * Runs before any Supabase driver query or credit deduction.
 * AI validation is handled separately in validateDriverSearchInput.ts.
 */

export const SEARCH_VALIDATION_ERROR =
  "Please enter the driver's real first and last name to search CDL Score.";

export interface BasicValidationResult {
  valid: boolean;
  reason?: string;
  cleaned_name?: string;
}

const BLOCKED_EXACT = new Set([
  'asdf', 'asdfasdf', 'qwerty', 'test', 'testing', 'driver', 'unknown',
  'none', 'na', 'n/a', 'null', 'undefined', 'admin', 'user', 'name',
  'firstname', 'lastname', 'first', 'last', 'abc', 'xyz', 'sample',
  'example', 'demo', 'fake', 'dummy', 'person', 'someone', 'anyone',
]);

const BLOCKED_WORDS = new Set([
  'asdf', 'qwerty', 'test', 'testing', 'driver', 'unknown', 'truck',
  'trucker', 'cdl', 'carrier', 'company', 'llc', 'inc', 'corp',
]);

const PROFANITY = new Set([
  'damn', 'hell', 'shit', 'fuck', 'fucking', 'ass', 'asshole', 'bitch',
  'bastard', 'crap', 'piss', 'dick', 'cock',
]);

const COMPANY_MARKERS =
  /\b(LLC|L\.L\.C\.|INC|INCORPORATED|CORP|CORPORATION|CO\.|COMPANY|LTD|LOGISTICS|TRUCKING|FREIGHT|TRANSPORT|CARRIER|ENTERPRISES|SERVICES|HOLDINGS|GROUP)\b/i;

const EMAIL_PATTERN = /@/;
const PHONE_PATTERN = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}|\b\d{10,}\b/;
const MC_PATTERN = /\bMC[\s#-]*\d{4,}\b/i;

/** Title-case each word for cleaned_name fallback when AI is unavailable. */
export function cleanDriverName(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Basic validation — fast, offline checks only.
 * Returns valid:false with an internal reason; callers should show SEARCH_VALIDATION_ERROR to users.
 */
export function validateDriverSearchBasic(input: string): BasicValidationResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, reason: 'empty' };
  }

  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (BLOCKED_EXACT.has(normalized.replace(/\s/g, '')) || BLOCKED_EXACT.has(normalized)) {
    return { valid: false, reason: 'blocked_test_input' };
  }

  if (EMAIL_PATTERN.test(trimmed)) {
    return { valid: false, reason: 'looks_like_email' };
  }

  if (PHONE_PATTERN.test(trimmed.replace(/[^\d+().-\s]/g, ''))) {
    return { valid: false, reason: 'looks_like_phone' };
  }

  if (MC_PATTERN.test(trimmed)) {
    return { valid: false, reason: 'looks_like_mc_number' };
  }

  if (COMPANY_MARKERS.test(trimmed)) {
    return { valid: false, reason: 'looks_like_company' };
  }

  // Must be at least first + last name
  if (!trimmed.includes(' ')) {
    return { valid: false, reason: 'missing_last_name' };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) {
    return { valid: false, reason: 'missing_last_name' };
  }

  if (words.some(w => w.length < 2)) {
    return { valid: false, reason: 'word_too_short' };
  }

  // Mostly alphabetic — allow letters, spaces, hyphens, apostrophes only
  if (!/^[a-zA-Z\s'\-]+$/.test(trimmed)) {
    return { valid: false, reason: 'non_alphabetic' };
  }

  const letterCount = (trimmed.match(/[a-zA-Z]/g) ?? []).length;
  const digitCount = (trimmed.match(/\d/g) ?? []).length;
  if (digitCount > 0 || letterCount / trimmed.replace(/\s/g, '').length < 0.85) {
    return { valid: false, reason: 'not_mostly_alphabetic' };
  }

  for (const word of words) {
    const lower = word.toLowerCase();
    if (BLOCKED_WORDS.has(lower)) {
      return { valid: false, reason: 'blocked_word' };
    }
    if (PROFANITY.has(lower)) {
      return { valid: false, reason: 'profanity' };
    }
  }

  if (trimmed.length < 4 || trimmed.length > 80) {
    return { valid: false, reason: 'invalid_length' };
  }

  return { valid: true, cleaned_name: cleanDriverName(trimmed) };
}
