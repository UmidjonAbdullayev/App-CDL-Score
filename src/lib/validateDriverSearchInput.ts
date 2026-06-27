/**
 * Full driver search validation pipeline (client orchestrator).
 *
 * Order:
 *  1. validateDriverSearchBasic() — local, instant
 *  2. Supabase Edge Function validate-driver-search — AI check (API key server-side only)
 *  3. On AI failure → fall back to basic result so search still works
 */

import { supabase } from './supabase';
import {
  validateDriverSearchBasic,
  SEARCH_VALIDATION_ERROR,
  type BasicValidationResult,
} from './searchValidation';

export interface DriverSearchValidationResult {
  valid: boolean;
  cleaned_name: string | null;
  /** User-facing message when valid is false */
  userMessage: string | null;
  usedAi: boolean;
  /** Dev-only hint for debugging AI setup */
  debugNote?: string;
}

interface AiValidationResponse {
  valid: boolean;
  reason?: string;
  cleaned_name?: string | null;
  ai_skipped?: boolean;
  openai_hint?: string;
  error?: string;
}

function devLog(message: string, detail?: unknown) {
  if (import.meta.env.DEV) {
    console.info(`[search-validation] ${message}`, detail ?? '');
  }
}

/**
 * Validate search input before querying drivers or deducting credits.
 * Call this at the start of executeSearch for new (non-cached) searches.
 */
export async function validateDriverSearchInput(
  rawInput: string
): Promise<DriverSearchValidationResult> {
  // ── Step 1: Basic validation (always runs first) ──────────────────────────
  const basic: BasicValidationResult = validateDriverSearchBasic(rawInput);
  if (!basic.valid) {
    devLog('blocked by basic validation', basic.reason);
    return {
      valid: false,
      cleaned_name: null,
      userMessage: SEARCH_VALIDATION_ERROR,
      usedAi: false,
    };
  }

  // ── Step 2: AI validation via Edge Function (optional) ────────────────────
  try {
    const { data, error } = await supabase.functions.invoke('validate-driver-search', {
      body: { query: rawInput.trim() },
    });

    if (error) {
      devLog('edge function error — falling back to basic only', error);
      throw error;
    }

    const ai = data as AiValidationResponse;

    if (ai?.error) {
      devLog('edge function returned error — falling back to basic only', ai.error);
      throw new Error(ai.error);
    }

    if (ai?.ai_skipped || ai?.reason === 'ai_not_configured' || ai?.reason === 'openai_error') {
      const hint = ai.openai_hint ?? (
        ai.reason === 'ai_not_configured'
          ? 'Set OPENAI_API_KEY in Supabase → Edge Functions → Secrets (CDL Score project).'
          : undefined
      );
      devLog(
        hint
          ? `AI skipped (${ai.reason}): ${hint}`
          : `AI skipped (${ai.reason ?? 'unknown'}). Using basic validation only.`
      );
      return {
        valid: true,
        cleaned_name: basic.cleaned_name ?? rawInput.trim(),
        userMessage: null,
        usedAi: false,
        debugNote: hint ?? ai.reason ?? 'ai_skipped',
      };
    }

    if (!ai.valid) {
      devLog('AI rejected query', ai.reason);
      return {
        valid: false,
        cleaned_name: null,
        userMessage: SEARCH_VALIDATION_ERROR,
        usedAi: true,
      };
    }

    devLog('AI approved query', ai.cleaned_name);
    return {
      valid: true,
      cleaned_name: (ai.cleaned_name?.trim() || basic.cleaned_name) ?? rawInput.trim(),
      userMessage: null,
      usedAi: true,
    };
  } catch (err) {
    // ── Step 3: Fallback — basic validation only ────────────────────────────
    devLog('AI unavailable — falling back to basic only', err);
    return {
      valid: true,
      cleaned_name: basic.cleaned_name ?? rawInput.trim(),
      userMessage: null,
      usedAi: false,
      debugNote: 'ai_fallback',
    };
  }
}
