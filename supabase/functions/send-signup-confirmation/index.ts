// Sends a branded Tag signup-confirmation email via Resend.
//
// `supabase.auth.signUp()` also triggers Supabase's own built-in
// confirmation email when the project requires email confirmation, but that
// path has proven unreliable (see send-password-reset, which was built for
// the same reason). This bypasses it the same way: generate the real
// confirmation link with the service role, then deliver it through the
// Lovable Resend connector gateway.
//
// Public endpoint: validates email format only. Always returns 200 to avoid
// leaking which addresses are registered.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { z } from "npm:zod@3.23.8";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "Tag <noreply@tag-tech.co.za>";
const INK = "#0d0d0d";
const CREAM = "#F5F1EA";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_URL = Deno.env.get("PUBLIC_SITE_URL") || "https://www.tag-tech.co.za";

const BodySchema = z.object({
  email: z.string().email(),
  redirectTo: z.string().url().optional(),
});

function brandedHtml(ctaUrl: string, mode: "signup" | "magiclink" = "signup") {
  const heading = mode === "magiclink" ? "Continue to Tag" : "Confirm your email";
  const body =
    mode === "magiclink"
      ? "Use this secure link to continue to Tag. If your email still needs confirmation, this link will complete that step too."
      : "Welcome to Tag — click the button below to confirm your email address and finish setting up your account.";
  const button = mode === "magiclink" ? "Continue to Tag" : "Confirm email";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${CREAM};font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${INK}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM}">
    <tr><td align="center" style="padding:40px 16px">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px -12px rgba(13,13,13,0.15)">
        <tr><td style="background:${INK};padding:24px 28px">
          <h1 style="margin:0;color:${CREAM};font-family:'Sora','Manrope',sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.02em">Tag</h1>
        </td></tr>
        <tr><td style="padding:32px 28px">
          <h2 style="margin:0 0 14px;font-family:'Sora','Manrope',sans-serif;font-size:24px;font-weight:700;color:${INK};letter-spacing:-0.02em">${heading}</h2>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#374151">
            ${body}
          </p>
          <p style="margin:0 0 28px">
            <a href="${ctaUrl}" style="display:inline-block;background:${INK};color:${CREAM};text-decoration:none;padding:14px 26px;border-radius:12px;font-weight:600;font-size:15px;font-family:'Sora','Manrope',sans-serif">${button}</a>
          </p>
          <p style="margin:24px 0 0;font-size:12px;color:#6b7280;line-height:1.55">
            If you didn't create a Tag account, you can safely ignore this email.
          </p>
        </td></tr>
        <tr><td style="background:${CREAM};padding:18px 28px;text-align:center;font-size:12px;color:#6b7280">
          © Tag · <a href="${SITE_URL}" style="color:${INK};text-decoration:none;font-weight:600">tag-tech.co.za</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function readActionUrl(linkData: unknown) {
  const data = linkData as { properties?: { action_link?: string }; action_link?: string } | null;
  return data?.properties?.action_link || data?.action_link || null;
}

async function sendEmail(to: string, subject: string, html: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
    return { ok: false, status: 500, error: "Email is not configured" };
  }
  const resp = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  const text = await resp.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* keep as text */
  }
  return {
    ok: resp.ok,
    status: resp.status,
    data,
    error: resp.ok ? undefined : `Resend ${resp.status}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { email, redirectTo } = parsed.data;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // `password` is required by the admin API's type signature but is only
    // used if this call also has to create the user — for an existing
    // unconfirmed signup (the normal case here) it's ignored and the link
    // is issued for the account as-is.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "signup",
      email,
      password: crypto.randomUUID(),
      options: redirectTo ? { redirectTo } : undefined,
    });

    let actionUrl = readActionUrl(linkData);
    let emailMode: "signup" | "magiclink" = "signup";

    if (!actionUrl && linkErr?.message?.toLowerCase().includes("already")) {
      // Repeated signups for the same unconfirmed email are common. The signup
      // link API refuses those, so fall back to a one-time email link rather
      // than silently telling the user to check an inbox that will receive
      // nothing. The endpoint still returns the same response for privacy.
      const { data: magicData, error: magicErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: redirectTo ? { redirectTo } : undefined,
      });
      actionUrl = readActionUrl(magicData);
      emailMode = "magiclink";
      if (!actionUrl) {
        console.warn("[send-signup-confirmation] magiclink fallback silenced:", magicErr?.message);
      }
    } else if (linkErr || !linkData) {
      console.warn("[send-signup-confirmation] generateLink silenced:", linkErr?.message);
    }

    if (!actionUrl) {
      console.warn("[send-signup-confirmation] no action link");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await sendEmail(
      email,
      emailMode === "magiclink" ? "Continue to Tag" : "Confirm your Tag account",
      brandedHtml(actionUrl, emailMode),
    );
    console.log("[send-signup-confirmation] dispatch", {
      to: email,
      ok: result.ok,
      status: result.status,
    });
    if (!result.ok) {
      console.error(
        "[send-signup-confirmation] send failed",
        result.status,
        result.error,
        result.data,
      );
      return new Response(JSON.stringify({ error: "Email send failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[send-signup-confirmation] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
