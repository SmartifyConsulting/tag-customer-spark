// Supabase Auth "Send Email" hook -> Resend via Lovable connector gateway.
// Sends branded auth emails from noreply@mypenguin.co.za.
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const FROM = "MyPenguin <noreply@mypenguin.co.za>";
const BRAND = "#031C4D";
const ACCENT = "#10B981";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
};

interface EmailPayload {
  user: { email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type:
      | "signup"
      | "recovery"
      | "invite"
      | "magiclink"
      | "email_change"
      | "reauthentication";
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function subjectFor(t: string) {
  switch (t) {
    case "recovery": return "Reset your MyPenguin password";
    case "signup": return "Confirm your MyPenguin account";
    case "magiclink": return "Your MyPenguin sign-in link";
    case "invite": return "You've been invited to MyPenguin";
    case "email_change": return "Confirm your new MyPenguin email";
    case "reauthentication": return "Confirm it's you on MyPenguin";
    default: return "MyPenguin";
  }
}

function headingFor(t: string) {
  switch (t) {
    case "recovery": return "Reset your password";
    case "signup": return "Welcome to MyPenguin";
    case "magiclink": return "Sign in to MyPenguin";
    case "invite": return "You're invited";
    case "email_change": return "Confirm your new email";
    case "reauthentication": return "Confirm it's you";
    default: return "MyPenguin";
  }
}

function ctaFor(t: string) {
  switch (t) {
    case "recovery": return "Reset password";
    case "signup": return "Confirm email";
    case "magiclink": return "Sign in";
    case "invite": return "Accept invite";
    case "email_change": return "Confirm email";
    default: return "Continue";
  }
}

function buildHtml(actionUrl: string, actionType: string) {
  const heading = headingFor(actionType);
  const cta = ctaFor(actionType);
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f7fb;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,.08);">
        <tr><td style="background:${BRAND};padding:22px 28px;color:#ffffff;font-weight:700;font-size:18px;">MyPenguin</td></tr>
        <tr><td style="padding:32px 28px;">
          <h1 style="margin:0 0 12px;font-size:22px;color:${BRAND};">${heading}</h1>
          <p style="margin:0 0 20px;line-height:1.55;color:#334155;">
            ${actionType === "recovery"
              ? "We received a request to reset your MyPenguin password. Click the button below to choose a new one. This link expires shortly for your security."
              : "Click the button below to continue."}
          </p>
          <p style="margin:24px 0;">
            <a href="${actionUrl}" style="background:${ACCENT};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block;">${cta}</a>
          </p>
          <p style="margin:0 0 8px;color:#64748b;font-size:13px;">Or copy this link into your browser:</p>
          <p style="margin:0 0 24px;word-break:break-all;font-size:13px;"><a href="${actionUrl}" style="color:${BRAND};">${actionUrl}</a></p>
          <p style="margin:0;color:#94a3b8;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>
        </td></tr>
        <tr><td style="padding:18px 28px;background:#f8fafc;color:#94a3b8;font-size:12px;">© MyPenguin · mypenguin.co.za</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!hookSecret) throw new Error("SEND_EMAIL_HOOK_SECRET not set");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY not set");
    if (!resendKey) throw new Error("RESEND_API_KEY not set");

    const payload = await req.text();
    const headers = Object.fromEntries(req.headers);

    // Supabase signs with "v1,<base64>" scheme; secret must be base64 form (prefix with v1,whsec_).
    const wh = new Webhook(hookSecret.startsWith("v1,whsec_") ? hookSecret : `v1,whsec_${btoa(hookSecret)}`);
    const data = wh.verify(payload, headers) as EmailPayload;

    const { user, email_data } = data;
    const actionUrl = `${email_data.site_url}/auth/v1/verify?token=${email_data.token_hash}&type=${email_data.email_action_type}&redirect_to=${encodeURIComponent(email_data.redirect_to)}`;

    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from: FROM,
        to: [user.email],
        subject: subjectFor(email_data.email_action_type),
        html: buildHtml(actionUrl, email_data.email_action_type),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("resend send failed", res.status, body);
      return new Response(JSON.stringify({ error: "send_failed", status: res.status, body }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-auth-email error", err);
    return new Response(JSON.stringify({ error: String(err instanceof Error ? err.message : err) }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
