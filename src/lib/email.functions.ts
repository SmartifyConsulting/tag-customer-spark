import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getRetailer(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("retailer_id, retailers:retailer_id(id, name)")
    .eq("user_id", userId)
    .not("retailer_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data?.retailers ?? null;
}

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { to: string }) => z.object({ to: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sendEmail, testTemplate } = await import("./email.server");
    const r = await getRetailer(context.supabase, context.userId);
    const ws = r?.name ?? "your workspace";
    const result = await sendEmail({ to: data.to, subject: `Tag · test email from ${ws}`, html: testTemplate(ws) });
    return { ok: true, id: result.id };
  });

export const sendStaffInvitationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { to: string; name?: string | null; role: string; inviteUrl?: string }) =>
    z.object({ to: z.string().email(), name: z.string().nullable().optional(), role: z.string(), inviteUrl: z.string().url().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sendEmail, staffInviteTemplate } = await import("./email.server");
    const r = await getRetailer(context.supabase, context.userId);
    const ws = r?.name ?? "Tag";
    const inviteUrl = data.inviteUrl ?? `${process.env.SITE_URL ?? "https://tag-customer-spark.lovable.app"}/auth`;
    return sendEmail({
      to: data.to,
      subject: `You've been invited to ${ws} on Tag`,
      html: staffInviteTemplate({ name: data.name ?? null, workspace: ws, role: data.role, inviteUrl }),
    });
  });

export const sendDailyBriefingEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { to: string; summary?: string }) =>
    z.object({ to: z.string().email(), summary: z.string().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { sendEmail, dailyBriefingTemplate } = await import("./email.server");
    const r = await getRetailer(context.supabase, context.userId);
    const ws = r?.name ?? "Tag";
    const since = new Date(Date.now() - 86400000).toISOString();
    const [scansQ, waitingQ, revenueQ] = await Promise.all([
      context.supabase.from("qr_scans").select("id", { count: "exact", head: true }).gte("created_at", since),
      context.supabase.from("customers").select("id", { count: "exact", head: true }),
      context.supabase.from("roi_attributions").select("revenue_amount").gte("created_at", since),
    ]);
    const revenue = (revenueQ.data ?? []).reduce((s: number, r: any) => s + Number(r.revenue_amount ?? 0), 0);
    const summary = data.summary ?? `Yesterday Tag turned ${scansQ.count ?? 0} scans into opportunity. Keep momentum by reviewing the opportunity feed.`;
    return (await import("./email.server")).sendEmail({
      to: data.to,
      subject: `${ws} · morning briefing`,
      html: dailyBriefingTemplate({
        workspace: ws,
        date: new Date().toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" }),
        summary,
        scans: scansQ.count ?? 0,
        revenue: Math.round(revenue),
        waiting: waitingQ.count ?? 0,
        ctaUrl: `${process.env.SITE_URL ?? "https://tag-customer-spark.lovable.app"}/intelligence`,
      }),
    });
  });

export const sendWeeklyRoiEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { to: string }) => z.object({ to: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    const { sendEmail, weeklyRoiTemplate } = await import("./email.server");
    const r = await getRetailer(context.supabase, context.userId);
    const ws = r?.name ?? "Tag";
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [roiQ, campQ] = await Promise.all([
      context.supabase.from("roi_attributions").select("revenue_amount").gte("created_at", since),
      context.supabase.from("notification_campaigns").select("id", { count: "exact", head: true }).gte("created_at", since),
    ]);
    const revenue = (roiQ.data ?? []).reduce((s: number, r: any) => s + Number(r.revenue_amount ?? 0), 0);
    return sendEmail({
      to: data.to,
      subject: `${ws} · weekly ROI report`,
      html: weeklyRoiTemplate({
        workspace: ws,
        weekLabel: `the week ending ${new Date().toLocaleDateString("en-ZA")}`,
        revenue: Math.round(revenue),
        campaigns: campQ.count ?? 0,
        conversion: 24,
        ctaUrl: `${process.env.SITE_URL ?? "https://tag-customer-spark.lovable.app"}/roi`,
      }),
    });
  });
