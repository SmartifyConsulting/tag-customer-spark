// Resend email sender via Lovable connector gateway. Server-only.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export const DEFAULT_FROM = "Tag <noreply@tag-tech.co.za>";

export type EmailPayload = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
};

export async function sendEmail(payload: EmailPayload) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!lovableKey || !resendKey) {
    throw new Error("Email is not configured: missing Resend credentials.");
  }

  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": resendKey,
    },
    body: JSON.stringify({
      from: payload.from ?? DEFAULT_FROM,
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      reply_to: payload.replyTo,
    }),
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const msg = (data as any)?.message || (data as any)?.error?.message || `Resend error ${res.status}`;
    throw new Error(msg);
  }
  return { id: (data as any)?.id as string | undefined };
}

// ---- Templates ----
const baseStyles = `
  body { margin:0; background:#f4f5f7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color:#0f172a; }
  .wrap { max-width:560px; margin:0 auto; padding:32px 20px; }
  .card { background:#fff; border-radius:18px; padding:32px; box-shadow:0 1px 2px rgba(15,23,42,0.06); }
  h1 { font-size:22px; margin:0 0 12px; color:#031C4D; }
  p { font-size:15px; line-height:1.55; color:#334155; margin:0 0 14px; }
  .btn { display:inline-block; background:#031C4D; color:#fff !important; text-decoration:none; padding:12px 22px; border-radius:10px; font-weight:600; }
  .meta { color:#64748b; font-size:12px; margin-top:24px; text-align:center; }
  .stat { display:inline-block; padding:12px 16px; background:#f8fafc; border-radius:12px; margin:4px 6px 0 0; }
  .stat b { display:block; color:#031C4D; font-size:18px; }
  .stat span { font-size:11px; color:#64748b; text-transform:uppercase; letter-spacing:.05em; }
`;

export function shell(title: string, inner: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${baseStyles}</style></head>
  <body><div class="wrap"><div class="card">${inner}</div>
  <p class="meta">Tag · Retail engagement<br/>You're receiving this from your Tag workspace.</p>
  </div></body></html>`;
}

export function staffInviteTemplate(opts: { name?: string | null; workspace: string; role: string; inviteUrl: string }) {
  return shell("You've been invited to Tag", `
    <h1>Welcome to ${escapeHtml(opts.workspace)}</h1>
    <p>${opts.name ? `Hi ${escapeHtml(opts.name)}, you've` : "You've"} been invited to join <b>${escapeHtml(opts.workspace)}</b> on Tag as <b>${escapeHtml(prettyRole(opts.role))}</b>.</p>
    <p><a class="btn" href="${opts.inviteUrl}">Accept invitation</a></p>
    <p>If you didn't expect this, you can ignore this email.</p>
  `);
}

export function dailyBriefingTemplate(opts: { workspace: string; date: string; summary: string; scans: number; revenue: number; waiting: number; ctaUrl: string }) {
  return shell("Your Tag morning briefing", `
    <h1>Good morning · ${escapeHtml(opts.workspace)}</h1>
    <p style="color:#64748b">${escapeHtml(opts.date)}</p>
    <p>${escapeHtml(opts.summary)}</p>
    <div>
      <div class="stat"><b>${opts.scans}</b><span>Scans yesterday</span></div>
      <div class="stat"><b>R ${opts.revenue.toLocaleString()}</b><span>Recovered</span></div>
      <div class="stat"><b>${opts.waiting}</b><span>Customers waiting</span></div>
    </div>
    <p style="margin-top:22px"><a class="btn" href="${opts.ctaUrl}">Open intelligence hub</a></p>
  `);
}

export function weeklyRoiTemplate(opts: { workspace: string; weekLabel: string; revenue: number; campaigns: number; conversion: number; ctaUrl: string }) {
  return shell("Your weekly ROI report", `
    <h1>${escapeHtml(opts.workspace)} · weekly ROI</h1>
    <p>Here's how Tag performed for you in <b>${escapeHtml(opts.weekLabel)}</b>.</p>
    <div>
      <div class="stat"><b>R ${opts.revenue.toLocaleString()}</b><span>Revenue recovered</span></div>
      <div class="stat"><b>${opts.campaigns}</b><span>Campaigns sent</span></div>
      <div class="stat"><b>${opts.conversion}%</b><span>Conversion</span></div>
    </div>
    <p style="margin-top:22px"><a class="btn" href="${opts.ctaUrl}">View full ROI dashboard</a></p>
  `);
}

export function customerCampaignTemplate(opts: { headline: string; body: string; ctaLabel?: string | null; ctaUrl?: string | null; imageUrl?: string | null; workspace: string }) {
  return shell(opts.headline, `
    ${opts.imageUrl ? `<img src="${opts.imageUrl}" alt="" style="width:100%;border-radius:12px;margin-bottom:16px"/>` : ""}
    <h1>${escapeHtml(opts.headline)}</h1>
    <p>${escapeHtml(opts.body)}</p>
    ${opts.ctaLabel && opts.ctaUrl ? `<p><a class="btn" href="${opts.ctaUrl}">${escapeHtml(opts.ctaLabel)}</a></p>` : ""}
    <p style="color:#64748b;font-size:12px;margin-top:24px">Sent by ${escapeHtml(opts.workspace)} via Tag.</p>
  `);
}

export function testTemplate(workspace: string) {
  return shell("Tag email test", `
    <h1>It works!</h1>
    <p>This is a test email sent from <b>${escapeHtml(workspace)}</b> via Resend.</p>
    <p>Your customer notifications, staff invites, daily briefings and weekly ROI reports will use this same channel.</p>
  `);
}

function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function prettyRole(r: string) {
  return ({ super_admin: "Super Administrator", retail_admin: "Retail Administrator", store_manager: "Store Manager", sales_assistant: "Sales Assistant" } as any)[r] ?? r;
}
