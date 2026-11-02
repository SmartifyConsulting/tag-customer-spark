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

/**
 * Emails every system administrator when this month's AI/search spend reaches a
 * level of the monthly budget (the warning percentage, then 100%). Each level is
 * sent once per month, tracked with a marker row like the credit alert below.
 */
export async function notifyBudgetThreshold(
  monthKey: string,
  level: number,
  spend: number,
  budget: number,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const marker = `budget_alert:${monthKey}:${level}`;
    const { data: sent } = await supabaseAdmin
      .from("ai_usage_events")
      .select("id")
      .eq("provider", "alert")
      .eq("operation", marker)
      .limit(1);
    if (sent && sent.length > 0) return;
    await supabaseAdmin.from("ai_usage_events").insert({ provider: "alert", operation: marker, cost_usd: 0 });

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "super_admin");
    const emails: string[] = [];
    for (const r of roles ?? []) {
      const { data } = await supabaseAdmin.auth.admin.getUserById((r as any).user_id);
      if (data?.user?.email) emails.push(data.user.email);
    }
    if (emails.length === 0) return;

    const over = level >= 100;
    const { sendEmail } = await import("./email.server");
    await sendEmail({
      to: emails,
      subject: over ? "Tag · monthly AI budget reached" : `Tag · ${level}% of the monthly AI budget used`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#1F3A5F">
        <h2 style="margin:0 0 12px">${over ? "The monthly AI budget has been reached" : `${level}% of the monthly AI budget is used`}</h2>
        <p>So far this month Tag has spent about <b>USD ${spend.toFixed(2)}</b> on AI and search, against a budget of <b>USD ${budget.toFixed(2)}</b>.</p>
        <p>Nothing has been switched off. See what is using it in Admin &rsaquo; Token ledger.</p>
        <p style="color:#666;font-size:12px">These figures are estimates; exact billing is on each provider's account. You'll get this email once per month for each level.</p>
      </div>`,
    });
  } catch (e) {
    console.warn("[admin-alerts] could not send budget alert", e);
  }
}

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
