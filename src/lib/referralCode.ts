import { supabase } from './supabase';

const INVALID_REFERRAL_MSG =
  'This referral code was not found. Remove it or enter a valid code to continue.';

export async function validateReferralCodeInput(code: string): Promise<{ valid: true } | { valid: false; error: string }> {
  const trimmed = code.trim();
  if (!trimmed) return { valid: true };

  const { data, error } = await supabase.rpc('validate_referral_code', {
    p_referral_code: trimmed,
  });

  if (error) {
    return { valid: false, error: error.message || INVALID_REFERRAL_MSG };
  }

  const res = data as { valid?: boolean; error?: string };
  if (res?.valid) return { valid: true };
  return { valid: false, error: res?.error ?? INVALID_REFERRAL_MSG };
}

export { INVALID_REFERRAL_MSG };
