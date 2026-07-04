// Sends a branded MyPenguin password-reset email via Resend.
// Public endpoint: validates email format only. Always returns 200 to avoid
// leaking which addresses are registered.
//
// Method copied from Holarc Health: bypasses Supabase's built-in send-email
// hook by using admin.auth.admin.generateLink() with the service role, then
// sending a branded email through the Lovable Resend connector gateway.

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { z } from "npm:zod@3.23.8";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "MyPenguin <noreply@mypenguin.co.za>";
const BRAND = "#1F3B2D";          // Deep forest
const ACCENT = "#F4C9A8";         // Peach
const CREAM = "#F5F1EA";
const INK = "#0E0E0E";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_URL =
  Deno.env.get("PUBLIC_SITE_URL") || "https://mypenguin.co.za";

const BodySchema = z.object({
  email: z.string().email(),
  redirectTo: z.string().url().optional(),
});

function brandedHtml(ctaUrl: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${CREAM};font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:${INK}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM}">
    <tr><td align="center" style="padding:40px 16px">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px -12px rgba(31,59,45,0.15)">
        <tr><td style="background:${BRAND};padding:24px 28px">
          <h1 style="margin:0;color:${CREAM};font-family:'Sora','Manrope',sans-serif;font-size:22px;font-weight:700;letter-spacing:-0.02em">MyPenguin</h1>
        </td></tr>
        <tr><td style="padding:32px 28px">
          <h2 style="margin:0 0 14px;font-family:'Sora','Manrope',sans-serif;font-size:24px;font-weight:700;color:${INK};letter-spacing:-0.02em">Reset your password</h2>
          <p style="margin:0 0 22px;font-size:15px;line-height:1.55;color:#374151">
            We received a request to reset the password for your MyPenguin account.
            Click the button below to choose a new one. This link expires in 1 hour.
          </p>
          <p style="margin:0 0 28px">
            <a href="${ctaUrl}" style="display:inline-block;background:${BRAND};color:${CREAM};text-decoration:none;padding:14px 26px;border-radius:12px;font-weight:600;font-size:15px;font-family:'Sora','Manrope',sans-serif">Reset password</a>
          </p>
          <p style="margin:24px 0 0;font-size:12px;color:#6b7280;line-height:1.55">
            If you didn't request a password reset, you can safely ignore this email — your password won't change.
          </p>
        </td></tr>
        <tr><td style="background:${CREAM};padding:18px 28px;text-align:center;font-size:12px;color:#6b7280">
          © MyPenguin · <a href="${SITE_URL}" style="color:${BRAND};text-decoration:none;font-weight:600">mypenguin.co.za</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
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
  try { data = text ? JSON.parse(text) : null; } catch { /* keep as text */ }
  return { ok: resp.ok, status: resp.status, data, error: resp.ok ? undefined : `Resend ${resp.status}` };
}

async function sendWhatsAppReset(to: string, resetUrl: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  const FROM_WA = Deno.env.get("TWILIO_WHATSAPP_FROM");
  if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !FROM_WA) return { ok: false };
  const toWa = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const fromWa = FROM_WA.startsWith("whatsapp:") ? FROM_WA : `whatsapp:${FROM_WA}`;
  const body =
    `Your MyPenguin password reset link: ${resetUrl}\n\n` +
    `Expires in 1 hour. If you didn't request this, ignore this message.`;
  const form = new URLSearchParams({ To: toWa, From: fromWa, Body: body });
  try {
    const resp = await fetch(`https://connector-gateway.lovable.dev/twilio/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.warn("[send-password-reset] whatsapp failed", resp.status, t.slice(0, 200));
      return { ok: false };
    }
    return { ok: true };
  } catch (e) {
    console.warn("[send-password-reset] whatsapp error", (e as Error).message);
    return { ok: false };
  }
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
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
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
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: redirectTo ? { redirectTo } : undefined,
    });

    // Don't leak whether the email exists — always return ok.
    if (linkErr || !linkData) {
      console.warn("[send-password-reset] generateLink silenced:", linkErr?.message);
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actionUrl =
      (linkData as any).properties?.action_link ||
      (linkData as any).action_link;
    if (!actionUrl) {
      console.warn("[send-password-reset] no action link");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await sendEmail(
      email,
      "Reset your MyPenguin password",
      brandedHtml(actionUrl),
    );
    console.log("[send-password-reset] dispatch", {
      to: email,
      ok: result.ok,
      status: result.status,
    });
    if (!result.ok) {
      console.error("[send-password-reset] send failed", result.status, result.error, result.data);
      return new Response(JSON.stringify({ error: "Email send failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Additive: also send via WhatsApp if the user has a phone number on their profile.
    try {
      const userId = (linkData as any).user?.id ?? (linkData as any).properties?.user_id;
      if (userId) {
        const { data: profile } = await admin
          .from("profiles")
          .select("whatsapp_e164")
          .eq("id", userId)
          .maybeSingle();
        const phone = (profile as any)?.whatsapp_e164;
        if (phone) {
          const waRes = await sendWhatsAppReset(phone, actionUrl);
          console.log("[send-password-reset] whatsapp", { userId, ok: waRes.ok });
        }
      }
    } catch (waErr) {
      console.warn("[send-password-reset] whatsapp lookup/send failed", (waErr as Error).message);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[send-password-reset] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
