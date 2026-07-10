import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_RECIPIENTS = 500;
const CHUNK = 25;

async function resolveRetailerId(
  supabase: any,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("retailer_id")
    .eq("user_id", userId)
    .not("retailer_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data?.retailer_id ?? null;
}

async function canManage(
  supabase: any,
  userId: string,
  retailerId: string,
): Promise<boolean> {
  const { data } = await supabase.rpc("can_manage_retailer", {
    _user_id: userId,
    _retailer_id: retailerId,
  });
  return !!data;
}

async function loadOptedInCustomers(
  supabase: any,
  retailerId: string,
): Promise<Array<{ id: string; whatsapp_e164: string; full_name: string | null }>> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, whatsapp_e164, full_name, status, marketing_consent_at")
    .eq("retailer_id", retailerId)
    .not("marketing_consent_at", "is", null)
    .eq("status", "active")
    .not("whatsapp_e164", "is", null)
    .limit(MAX_RECIPIENTS + 1);
  if (error) throw new Error(error.message);
  return (data ?? []) as any;
}

// ---------- audience preview ----------

export const previewBroadcastAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { count: 0, cap: MAX_RECIPIENTS };
    const rows = await loadOptedInCustomers(supabase, retailerId);
    return {
      count: Math.min(rows.length, MAX_RECIPIENTS),
      total: rows.length,
      cap: MAX_RECIPIENTS,
      over: rows.length > MAX_RECIPIENTS,
    };
  });

// ---------- list broadcasts ----------

export const listBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { rows: [] };
    const { data, error } = await supabase
      .from("broadcast_campaigns")
      .select(
        "id, heading, body, image_url, product_id, status, recipient_count, sent_count, failed_count, started_at, finished_at, created_at",
      )
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

// ---------- send ----------

const sendSchema = z.object({
  heading: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(1000),
  productId: z.string().uuid().nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  ctaUrl: z.string().url().nullable().optional(),
});

export const sendMarketingBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sendSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer assigned to your account");
    if (!(await canManage(supabase, userId, retailerId)))
      throw new Error("You don't have permission to send broadcasts");

    const [
      { sendWhatsApp },
      { canSendNotification, incrementNotificationUsage },
    ] = await Promise.all([
      import("@/lib/whatsapp.server"),
      import("@/lib/billing/overage.server"),
    ]);

    const gate = await canSendNotification(retailerId);
    if (!gate.allowed) throw new Error(gate.reason ?? "Notification quota reached");

    const audience = await loadOptedInCustomers(supabase, retailerId);
    if (audience.length === 0)
      throw new Error("No customers with active marketing consent");
    if (audience.length > MAX_RECIPIENTS)
      throw new Error(
        `Audience of ${audience.length} exceeds the ${MAX_RECIPIENTS}-recipient cap per broadcast.`,
      );

    // Create the broadcast row
    const now = new Date().toISOString();
    const { data: broadcast, error: bErr } = await supabase
      .from("broadcast_campaigns")
      .insert({
        retailer_id: retailerId,
        created_by: userId,
        heading: data.heading,
        body: data.body,
        image_url: data.imageUrl ?? null,
        product_id: data.productId ?? null,
        cta_url: data.ctaUrl ?? null,
        recipient_count: audience.length,
        sent_count: 0,
        failed_count: 0,
        status: "sending",
        started_at: now,
      })
      .select("id")
      .single();
    if (bErr || !broadcast) throw new Error(bErr?.message ?? "Failed to create broadcast");

    const composed = `*${data.heading}*\n\n${data.body}${data.ctaUrl ? `\n\n${data.ctaUrl}` : ""}`;

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < audience.length; i += CHUNK) {
      const slice = audience.slice(i, i + CHUNK);
      const results = await Promise.allSettled(
        slice.map(async (cust) => {
          const res = await sendWhatsApp({
            to: cust.whatsapp_e164,
            body: composed,
            mediaUrl: data.imageUrl ?? null,
          });
          await supabase.from("notification_history").insert({
            retailer_id: retailerId,
            customer_id: cust.id,
            broadcast_id: broadcast.id,
            channel: "whatsapp",
            status: res.ok ? "sent" : "failed",
            payload: {
              heading: data.heading,
              body: data.body,
              image_url: data.imageUrl ?? null,
              product_id: data.productId ?? null,
              cta_url: data.ctaUrl ?? null,
            },
            sent_at: res.ok ? new Date().toISOString() : null,
            provider_message_sid: res.sid ?? null,
            error: res.ok ? null : res.error ?? null,
          });
          return res.ok;
        }),
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) sent += 1;
        else failed += 1;
      }
    }

    if (sent > 0) await incrementNotificationUsage(retailerId, sent);

    await supabase
      .from("broadcast_campaigns")
      .update({
        sent_count: sent,
        failed_count: failed,
        status: failed === 0 ? "sent" : sent === 0 ? "failed" : "partial",
        finished_at: new Date().toISOString(),
      })
      .eq("id", broadcast.id);

    return { broadcastId: broadcast.id, sent, failed, audience: audience.length };
  });
