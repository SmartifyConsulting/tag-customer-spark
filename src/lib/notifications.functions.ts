import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function resolveRetailerId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("retailer_id")
    .eq("user_id", userId)
    .not("retailer_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data?.retailer_id ?? null;
}

export const campaignSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120),
  type: z.enum(["sale", "low_stock", "back_in_stock", "promotion", "custom"]),
  product_id: z.string().uuid().nullable().optional(),
  image_url: z.string().url().nullable().optional(),
  headline: z.string().trim().max(80).nullable().optional(),
  body: z.string().trim().max(800).nullable().optional(),
  cta_label: z.string().trim().max(40).nullable().optional(),
  cta_url: z.string().url().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  redemption_code: z.string().trim().max(40).nullable().optional(),
  audience_filter: z
    .object({
      product_ids: z.array(z.string().uuid()).optional(),
      store_ids: z.array(z.string().uuid()).optional(),
    })
    .default({}),
  scheduled_at: z.string().nullable().optional(),
  message_template: z.string().trim().min(1).max(1500).default("auto"),
});

export type CampaignInput = z.infer<typeof campaignSchema>;

export const getNotificationOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { products: [], stores: [], retailer: null };
    const [{ data: products }, { data: stores }, { data: retailer }] = await Promise.all([
      supabase.from("products").select("id, name, sku, image_url").eq("retailer_id", retailerId).eq("status", "active").order("name"),
      supabase.from("stores").select("id, name").eq("retailer_id", retailerId).order("name"),
      supabase.from("retailers").select("id, name, logo_url").eq("id", retailerId).maybeSingle(),
    ]);
    return { products: products ?? [], stores: stores ?? [], retailer };
  });

export const listCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.enum(["all", "draft", "scheduled", "sending", "sent", "completed", "cancelled"]).default("all"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("notification_campaigns")
      .select(
        "id, title, type, status, scheduled_at, sent_at, audience_size, funnel, image_url, headline, expires_at, product:products(id,name,image_url), updated_at",
      )
      .order("updated_at", { ascending: false });
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("notification_campaigns")
      .select("*, product:products(id,name,image_url)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");

    // funnel from notification_history
    const { data: history } = await supabase
      .from("notification_history")
      .select("status")
      .eq("campaign_id", data.id);
    const funnel: Record<string, number> = { queued: 0, sent: 0, delivered: 0, read: 0, clicked: 0, redeemed: 0, failed: 0 };
    (history ?? []).forEach((h: any) => {
      funnel[h.status] = (funnel[h.status] ?? 0) + 1;
    });
    return { campaign: row, funnel, total: history?.length ?? 0 };
  });

async function estimateAudience(supabase: any, retailerId: string, filter: any): Promise<number> {
  let q = supabase
    .from("customer_interests")
    .select("customer_id", { count: "exact", head: true })
    .eq("retailer_id", retailerId)
    .eq("status", "active");
  if (filter?.product_ids?.length) q = q.in("product_id", filter.product_ids);
  const { count } = await q;
  return count ?? 0;
}

export const estimateCampaignAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ audience_filter: z.any(), product_id: z.string().uuid().nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { count: 0 };
    const filter = { ...(data.audience_filter ?? {}) };
    if (data.product_id && !filter.product_ids?.length) filter.product_ids = [data.product_id];
    const count = await estimateAudience(supabase, retailerId, filter);
    return { count };
  });

export const upsertCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => campaignSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer assigned");

    const audienceSize = await estimateAudience(supabase, retailerId, {
      ...(data.audience_filter ?? {}),
      product_ids:
        data.audience_filter?.product_ids?.length
          ? data.audience_filter.product_ids
          : data.product_id
            ? [data.product_id]
            : undefined,
    });

    const row: any = {
      retailer_id: retailerId,
      title: data.title,
      type: data.type,
      product_id: data.product_id ?? null,
      image_url: data.image_url ?? null,
      headline: data.headline ?? null,
      body: data.body ?? null,
      cta_label: data.cta_label ?? null,
      cta_url: data.cta_url ?? null,
      expires_at: data.expires_at ?? null,
      redemption_code: data.redemption_code ?? null,
      audience_filter: data.audience_filter ?? {},
      audience_size: audienceSize,
      scheduled_at: data.scheduled_at ?? null,
      message_template: data.message_template ?? "auto",
      status: data.scheduled_at ? "scheduled" : "draft",
    };

    if (data.id) {
      const { error } = await supabase.from("notification_campaigns").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id, audienceSize };
    } else {
      row.created_by = userId;
      const { data: ins, error } = await supabase
        .from("notification_campaigns")
        .insert(row)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { id: ins!.id as string, audienceSize };
    }
  });

async function fanout(supabase: any, campaign: any): Promise<number> {
  const filter = campaign.audience_filter ?? {};
  let productIds: string[] = filter.product_ids ?? [];
  if (!productIds.length && campaign.product_id) productIds = [campaign.product_id];

  let q = supabase
    .from("customer_interests")
    .select("customer_id")
    .eq("retailer_id", campaign.retailer_id)
    .eq("status", "active");
  if (productIds.length) q = q.in("product_id", productIds);
  const { data: ints } = await q;
  const uniqueCustomers = Array.from(new Set((ints ?? []).map((r: any) => r.customer_id as string)));
  if (!uniqueCustomers.length) return 0;

  const now = new Date().toISOString();
  const rows = uniqueCustomers.map((cid) => ({
    campaign_id: campaign.id,
    customer_id: cid,
    retailer_id: campaign.retailer_id,
    channel: "whatsapp",
    status: "queued" as const,
    queued_at: now,
    payload: {
      headline: campaign.headline,
      body: campaign.body,
      image_url: campaign.image_url,
      cta_label: campaign.cta_label,
      cta_url: campaign.cta_url,
      redemption_code: campaign.redemption_code,
    },
  }));
  // chunk inserts to keep them small
  const chunk = 200;
  for (let i = 0; i < rows.length; i += chunk) {
    await supabase.from("notification_history").insert(rows.slice(i, i + chunk));
  }
  return rows.length;
}

export const enqueueCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), sendNow: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: campaign, error } = await supabase
      .from("notification_campaigns")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !campaign) throw new Error("Campaign not found");

    const queued = await fanout(supabase, campaign);

    const update: any = {
      audience_size: queued,
      status: data.sendNow ? "sending" : "scheduled",
    };
    if (data.sendNow) update.sent_at = new Date().toISOString();
    await supabase.from("notification_campaigns").update(update).eq("id", data.id);

    // Fire-and-forget: also email customers who have an email address on file
    if (data.sendNow) {
      try {
        const filter = campaign.audience_filter ?? {};
        let productIds: string[] = filter.product_ids ?? [];
        if (!productIds.length && campaign.product_id) productIds = [campaign.product_id];
        let iq = supabase.from("customer_interests").select("customer_id").eq("retailer_id", campaign.retailer_id).eq("status", "active");
        if (productIds.length) iq = iq.in("product_id", productIds);
        const { data: ints } = await iq;
        const ids = Array.from(new Set((ints ?? []).map((r: any) => r.customer_id)));
        if (ids.length) {
          const { data: custs } = await supabase.from("customers").select("email").in("id", ids).not("email", "is", null);
          const { data: retailer } = await supabase.from("retailers").select("name").eq("id", campaign.retailer_id).maybeSingle();
          const recipients = (custs ?? []).map((c: any) => c.email).filter(Boolean).slice(0, 200);
          if (recipients.length) {
            const { sendEmail, customerCampaignTemplate } = await import("./email.server");
            const html = customerCampaignTemplate({
              headline: campaign.headline ?? campaign.title,
              body: campaign.body ?? "",
              ctaLabel: campaign.cta_label,
              ctaUrl: campaign.cta_url,
              imageUrl: campaign.image_url,
              workspace: retailer?.name ?? "Tag",
            });
            await Promise.allSettled(
              recipients.map((to: string) =>
                sendEmail({ to, subject: campaign.headline ?? campaign.title, html }),
              ),
            );
          }
        }
      } catch (e) {
        console.error("campaign email fanout failed", e);
      }
    }

    return { queued };
  });

export const cancelCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notification_campaigns")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
