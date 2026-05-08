import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PurchaseNotification {
  companyName: string;
  companyEmail: string;
  searchCount: number;
  totalCost: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: PurchaseNotification = await req.json();
    const { companyName, companyEmail, searchCount, totalCost } = body;

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "re_huD438du_4wrxuuuXFhRSEG8onptaNuz5";
    const NOTIFY_EMAIL = "jordancrameyon@gmail.com";

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; color: #111;">
        <h2 style="margin: 0 0 16px; font-size: 18px;">New Purchase Request</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 140px;">Company</td>
            <td style="padding: 8px 0; font-weight: 600;">${companyName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Company Email</td>
            <td style="padding: 8px 0;">${companyEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Searches</td>
            <td style="padding: 8px 0; font-weight: 600;">${searchCount}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Total</td>
            <td style="padding: 8px 0; font-weight: 600;">$${Number(totalCost).toFixed(2)}</td>
          </tr>
        </table>
        <p style="margin-top: 20px; font-size: 13px; color: #888;">
          Log in to the CDL Score admin panel to approve this request and add credits.
        </p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "CDL Score <onboarding@resend.dev>",
        to: [NOTIFY_EMAIL],
        subject: `New Purchase Request: ${companyName} — ${searchCount} searches ($${Number(totalCost).toFixed(2)})`,
        html: emailHtml,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[purchase-notify] Resend error:", errText);
      return new Response(
        JSON.stringify({ success: false, error: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, sent: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[purchase-notify] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
