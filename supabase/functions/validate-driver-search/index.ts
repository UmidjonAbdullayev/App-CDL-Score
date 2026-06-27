/**
 * Server-side AI validation for driver search names.
 * API keys live ONLY in Supabase Edge Function secrets (never in frontend).
 *
 * Set in Supabase Dashboard → Edge Functions → Secrets:
 *   OPENAI_API_KEY=sk-...
 *
 * Optional: OPENAI_MODEL (default gpt-4o-mini)
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ValidateRequest {
  query: string;
}

interface ValidateResponse {
  valid: boolean;
  reason: string;
  cleaned_name: string | null;
  ai_skipped?: boolean;
  openai_hint?: string;
}

function titleCaseName(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function parseOpenAiHint(status: number, errText: string): string {
  try {
    const j = JSON.parse(errText) as { error?: { type?: string; code?: string; message?: string } };
    const t = j.error?.type ?? j.error?.code;
    const msg = j.error?.message ?? "";
    if (t === "invalid_api_key" || msg.toLowerCase().includes("incorrect api key")) {
      return "invalid_api_key — create a new key at platform.openai.com/api-keys and update OPENAI_API_KEY in Supabase";
    }
    if (t === "insufficient_quota" || status === 429) {
      return "insufficient_quota — add billing at platform.openai.com/account/billing";
    }
    if (msg) return msg.slice(0, 120);
  } catch { /* ignore */ }
  return `openai_http_${status}`;
}

function skipWithBasic(query: string, reason: string, openai_hint?: string): ValidateResponse {
  return {
    valid: true,
    reason,
    cleaned_name: titleCaseName(query),
    ai_skipped: true,
    openai_hint,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as ValidateRequest;
    const query = (body.query ?? "").trim();

    if (!query) {
      const out: ValidateResponse = {
        valid: false,
        reason: "empty_query",
        cleaned_name: null,
      };
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY")?.trim();
    if (!apiKey || !apiKey.startsWith("sk-")) {
      const out = skipWithBasic(
        query,
        "ai_not_configured",
        !apiKey
          ? "OPENAI_API_KEY secret missing in Supabase Edge Functions → Secrets"
          : "OPENAI_API_KEY must start with sk- — check for extra spaces or wrong value"
      );
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const model = (Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini").trim();

    const systemPrompt = `You validate whether a search query is likely a real person's first and last name (a CDL truck driver), not a company, email, phone, MC number, test string, or gibberish.

Respond with JSON only, no markdown:
{"valid": boolean, "reason": string, "cleaned_name": string|null}

Rules:
- valid=true only if it looks like a plausible human first + last name (middle names ok).
- valid=false for: companies (LLC, Inc, Logistics), emails, phones, MC numbers, "test", "driver", "unknown", keyboard mashing, profanity, single words, random strings.
- cleaned_name: title-cased full name if valid, else null.`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Query to validate: "${query}"` },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("[validate-driver-search] OpenAI error:", openaiRes.status, errText);
      const hint = parseOpenAiHint(openaiRes.status, errText);
      const out = skipWithBasic(query, "openai_error", hint);
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const completion = await openaiRes.json();
    const content = completion?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") {
      const out = skipWithBasic(query, "openai_empty_response");
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: { valid?: boolean; reason?: string; cleaned_name?: string | null };
    try {
      parsed = JSON.parse(content);
    } catch {
      const out = skipWithBasic(query, "openai_invalid_json");
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const out: ValidateResponse = {
      valid: Boolean(parsed.valid),
      reason: String(parsed.reason ?? "ai_validation"),
      cleaned_name: parsed.valid
        ? titleCaseName(String(parsed.cleaned_name ?? query))
        : null,
    };

    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[validate-driver-search] Error:", err);
    return new Response(
      JSON.stringify({ error: "Validation failed", detail: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
