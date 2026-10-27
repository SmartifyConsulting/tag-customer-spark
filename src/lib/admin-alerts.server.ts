// Server-only. Emails every system administrator when a paid service runs out
// of credit. Throttled to one email per service per 12 hours, using a marker
// row in ai_usage_events (provider = "alert") so no extra table is needed.
const THROTTLE_MS = 12 * 60 * 60 * 1000;

const SERVICES = {
  openai: {
    name: "OpenAI (ChatGPT)",
    use: "product enrichment, categories and product photo checks",
    billing: "https://platform.openai.com/settings/organization/billing/overview",
  },
  serper: {
    name: "Serper (Google image search)",
    use: "finding real product photos",
    billing: "https://serper.dev/billing",
  },
} as const;

export type CreditService = keyof typeof SERVICES;

export async function notifyAdminCreditExhausted(service: CreditService): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const marker = `credit_alert:${service}`;
    const since = new Date(Date.now() - THROTTLE_MS).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("ai_usage_events")
      .select("id")
      .eq("provider", "alert")
      .eq("operation", marker)
      .gte("created_at", since)
      .limit(1);
    if (recent && recent.length > 0) return;
    // Write the marker first so concurrent failures don't each send an email.
    await supabaseAdmin.from("ai_usage_events").insert({ provider: "alert", operation: marker, cost_usd: 0 });

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "super_admin");
    const emails: string[] = [];
    for (const r of roles ?? []) {
      const { data } = await supabaseAdmin.auth.admin.getUserById((r as any).user_id);
      if (data?.user?.email) emails.push(data.user.email);
    }
    if (emails.length === 0) return;

    const s = SERVICES[service];
    const { sendEmail } = await import("./email.server");
    await sendEmail({
      to: emails,
      subject: `Tag · ${s.name} needs a credit top-up`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#1F3A5F">
        <h2 style="margin:0 0 12px">${s.name} is out of credit</h2>
        <p>Tag uses ${s.name} for ${s.use}. It has stopped working because the account has no credit left.</p>
        <p>Products are still saved — the missing details and photos will fill in automatically once credit is added.</p>
        <p><a href="${s.billing}" style="background:#C1272D;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none">Top up ${s.name}</a></p>
        <p style="color:#666;font-size:12px">You'll get at most one of these emails every 12 hours.</p>
      </div>`,
    });
  } catch (e) {
    console.warn("[admin-alerts] could not send credit alert", e);
  }
}
