import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_RECIPIENTS = 500;
const CHUNK = 25;

// Marketing broadcasts must use an approved WhatsApp template — freeform
// text/image sends are only allowed within 24h of the customer's last
// inbound message, which defeats the purpose of a broadcast to an opted-in
// list. The template is resolved live from the provider (see
// broadcast-template.server.ts) because WhatsApp permanently rejects a send
// whose variable count doesn't match the APPROVED body.

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
    .in("status", ["subscribed", "registered"])
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
  /** Internal label only — never sent to WhatsApp. */
  internalName: z.string().trim().min(1).max(120),
  /** Feeds the approved template's {{expiry_date}} variable. */
  expiryDate: z.string().trim().min(1).max(40),
  imageUrl: z.string().url(),
  catalogueUrl: z.string().url(),
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
      { sendTemplate },
      { isPublicMediaUrl },
      { canSendNotification, incrementNotificationUsage },
    ] = await Promise.all([
      import("@/lib/whatsapp-service.server"),
      import("@/lib/whatsapp-templates.server"),
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

    // Preflight the approved template before anything is written. A mismatch
    // here is why broadcasts were accepted by the API and then never
    // delivered, so surface it as a plain error the sender can act on.
    const { resolveBroadcastTemplate } = await import("@/lib/broadcast-template.server");
    const resolved = await resolveBroadcastTemplate();
    if (!resolved.ok) throw new Error(resolved.error);

    // The approved template carries an IMAGE header, so an image is
    // compulsory — there is no silent logo fallback, because a broadcast that
    // quietly goes out branded with the workspace logo is not what was
    // composed.
    const headerImage = isPublicMediaUrl(data.imageUrl) ? data.imageUrl! : null;
    if (resolved.requiresImage && !headerImage) {
      throw new Error(
        "Every broadcast needs an image. Upload one, or paste a public https image link.",
      );
    }

    // Create the broadcast row. The internal name is stored in `heading`
    // (it is never sent), and the rendered offer wording in `body`.
    const renderedBody = resolved.bodyText.replace(
      /\{\{[^}]+\}\}/,
      data.expiryDate,
    );
    const now = new Date().toISOString();
    const { data: broadcast, error: bErr } = await supabase
      .from("broadcast_campaigns")
      .insert({
        retailer_id: retailerId,
        created_by: userId,
        heading: data.internalName,
        body: renderedBody,
        image_url: data.imageUrl,
        product_id: null,
        cta_url: data.catalogueUrl,
        recipient_count: audience.length,
        sent_count: 0,
        failed_count: 0,
        status: "sending",
        started_at: now,
      })
      .select("id")
      .single();
    if (bErr || !broadcast) throw new Error(bErr?.message ?? "Failed to create broadcast");

    // The approved template's variables: {{expiry_date}} in the body, and the
    // Shop Online button's URL when that button takes a per-send value.
    const variables: Record<string, string> = {};
    for (const key of resolved.contract.placeholders) {
      variables[key] = key === "expiry_date" ? data.expiryDate : data.expiryDate;
    }
    if (resolved.dynamicUrlButton) variables.urlButton = data.catalogueUrl;

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < audience.length; i += CHUNK) {
      const slice = audience.slice(i, i + CHUNK);
      const results = await Promise.allSettled(
        slice.map(async (cust) => {
          const res = await sendTemplate({
            templateName: resolved.contract.name,
            contract: resolved.contract,
            to: cust.whatsapp_e164,
            headerImageUrl: headerImage,
            variables,
          });
          await supabase.from("notification_history").insert({
            retailer_id: retailerId,
            customer_id: cust.id,
            broadcast_id: broadcast.id,
            channel: "whatsapp",
            status: res.ok ? "sent" : "failed",
            payload: {
              internal_name: data.internalName,
              expiry_date: data.expiryDate,
              body: renderedBody,
              image_url: data.imageUrl,
              catalogue_url: data.catalogueUrl,
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

// ---------- delivery breakdown ----------

/**
 * Per-broadcast delivery rollup. `sent_count` only means the provider accepted
 * the message; a broadcast can be fully "sent" and entirely undelivered (that
 * is exactly what a template mismatch looks like), so the UI reads delivery
 * receipts rather than the hand-off count.
 */
export const getBroadcastDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ids: z.array(z.string().uuid()).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId || data.ids.length === 0) return { rows: {} as Record<string, any> };

    const { data: rows, error } = await supabase
      .from("notification_history")
      .select("broadcast_id, status")
      .eq("retailer_id", retailerId)
      .in("broadcast_id", data.ids)
      .limit(20000);
    if (error) throw new Error(error.message);

    const out: Record<string, { accepted: number; delivered: number; read: number; failed: number }> = {};
    for (const id of data.ids) out[id] = { accepted: 0, delivered: 0, read: 0, failed: 0 };
    for (const r of (rows ?? []) as Array<{ broadcast_id: string; status: string }>) {
      const bucket = out[r.broadcast_id];
      if (!bucket) continue;
      const status = (r.status ?? "").toLowerCase();
      if (status === "failed" || status === "undelivered" || status === "rejected") bucket.failed += 1;
      else if (status === "read" || status === "clicked" || status === "redeemed") {
        bucket.read += 1;
        bucket.delivered += 1;
      } else if (status === "delivered") bucket.delivered += 1;
      else bucket.accepted += 1;
    }
    return { rows: out };
  });

/**
 * Reads the provider's own delivery log for a broadcast's messages. This is
 * how a downstream rejection (e.g. EC_INVALID_TEMPLATE) becomes visible —
 * those never appear as an error on the send call itself.
 */
export const diagnoseBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ broadcastId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer assigned to your account");
    if (!(await canManage(supabase, userId, retailerId)))
      throw new Error("You don't have permission to inspect broadcasts");

    const { data: rows } = await supabase
      .from("notification_history")
      .select("provider_message_sid")
      .eq("retailer_id", retailerId)
      .eq("broadcast_id", data.broadcastId)
      .not("provider_message_sid", "is", null)
      .limit(5);

    const { lookupInfobipMessageStatus } = await import("@/lib/whatsapp-infobip.server");
    const reports = await Promise.all(
      ((rows ?? []) as Array<{ provider_message_sid: string }>).map(async (r) => {
        const res = await lookupInfobipMessageStatus(r.provider_message_sid);
        const result = (res.result ?? {}) as any;
        return {
          messageId: r.provider_message_sid,
          groupName: result?.status?.groupName ?? null,
          description: result?.status?.description ?? null,
          errorName: result?.error?.name ?? null,
          errorDescription: result?.error?.description ?? null,
        };
      }),
    );

    const { resolveBroadcastTemplate } = await import("@/lib/broadcast-template.server");
    const template = await resolveBroadcastTemplate();

    return {
      reports,
      template: template.ok
        ? { ok: true as const, name: template.contract.name, language: template.contract.language }
        : { ok: false as const, error: template.error },
    };
  });

// ---------- broadcast image upload ----------

export const createBroadcastImageUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        filename: z.string().min(1).max(200),
        contentType: z.string().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer assigned to your account");
    if (!(await canManage(supabase, userId, retailerId)))
      throw new Error("You don't have permission to send broadcasts");
    if (!/^image\//i.test(data.contentType)) throw new Error("Only image files are supported");

    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${retailerId}/broadcasts/${crypto.randomUUID()}-${safe}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("product-images")
      .createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    const { data: pub } = supabaseAdmin.storage.from("product-images").getPublicUrl(path);

    return { path, uploadUrl: signed.signedUrl, token: signed.token, publicUrl: pub.publicUrl };
  });

// ---------- template capability (composer notice) ----------

/**
 * Tells the composer what the approved broadcast template can actually carry.
 * Broadcasts are pinned to tag_broadcast_v3; when it isn't approved on the
 * sender the composer blocks sending and shows the reason.
 */
export const getBroadcastTemplateInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { resolveBroadcastTemplate } = await import("@/lib/broadcast-template.server");
    const resolved = await resolveBroadcastTemplate();
    if (!resolved.ok) return { ok: false as const, error: resolved.error };
    return {
      ok: true as const,
      name: resolved.contract.name,
      language: resolved.contract.language,
      variableCount: resolved.variableCount,
      bodyText: resolved.bodyText,
      hasUrlButton: resolved.hasUrlButton,
      dynamicUrlButton: resolved.dynamicUrlButton,
      requiresImage: resolved.requiresImage,
      status: resolved.status,
    };
  });
