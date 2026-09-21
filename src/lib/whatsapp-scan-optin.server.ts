// Shopper-initiated opt-in: a phone-camera QR scan opens WhatsApp with a
// pre-filled message that carries a product ref. When that message arrives on
// the Infobip inbound webhook, this turns it into the same customer / interest /
// watch / conversation records the web form creates, and sends the same
// confirmation template. The shopper's number comes from WhatsApp itself.
//
// Ref format (see scanChatMessage in whatsapp-chat-link.ts):
//   "Ref G:<gtin14>"      — product QR (GS1 digital link)
//   "Ref T:<short_code>"  — retailer tag QR

import { validGtin14, findActiveProductByGtin } from "@/lib/gtin-lookup.server";

export type ScanRef = { kind: "G" | "T"; value: string };

export function parseScanRef(text: string): ScanRef | null {
  const m = /\bRef\s+([GT]):([A-Za-z0-9-]{1,64})/i.exec(text);
  if (!m) return null;
  return { kind: m[1].toUpperCase() as "G" | "T", value: m[2] };
}

type ResolvedTarget = {
  productId: string;
  retailerId: string;
  storeId: string | null;
  qrTagId: string | null;
  productName: string;
  retailerLogo: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
};

async function resolveTarget(supabaseAdmin: any, ref: ScanRef): Promise<ResolvedTarget | null> {
  if (ref.kind === "T") {
    const { data: tag } = await supabaseAdmin
      .from("qr_tags")
      .select(
        "id, product_id, retailer_id, store_id, is_active, product:products(name, thumbnail_url, image_url), retailer:retailers(logo_url)",
      )
      .eq("short_code", ref.value)
      .maybeSingle();
    if (!tag || !tag.is_active) return null;
    return {
      productId: tag.product_id,
      retailerId: tag.retailer_id,
      storeId: tag.store_id ?? null,
      qrTagId: tag.id,
      productName: tag.product?.name ?? "this product",
      retailerLogo: tag.retailer?.logo_url ?? "",
      thumbnailUrl: tag.product?.thumbnail_url ?? null,
      imageUrl: tag.product?.image_url ?? null,
    };
  }

  const gtin14 = validGtin14(ref.value);
  if (!gtin14) return null;
  const product = await findActiveProductByGtin(
    supabaseAdmin,
    gtin14,
    "id, retailer_id, store_id, name, image_url, hero_image, thumbnail_url",
  );
  if (!product) return null;
  const { data: retailer } = await supabaseAdmin
    .from("retailers")
    .select("logo_url")
    .eq("id", product.retailer_id)
    .maybeSingle();
  return {
    productId: product.id,
    retailerId: product.retailer_id,
    storeId: product.store_id ?? null,
    qrTagId: null,
    productName: product.name ?? "this product",
    retailerLogo: retailer?.logo_url ?? "",
    thumbnailUrl: product.thumbnail_url ?? null,
    imageUrl: product.hero_image ?? product.image_url ?? null,
  };
}

/**
 * Handles an inbound WhatsApp message that carries a scan ref.
 * Returns true when the message was a scan ref (handled or not resolvable),
 * so the caller can skip its normal free-form handling.
 */
export async function handleScanOptIn(
  supabaseAdmin: any,
  input: { from: string; text: string; profileName?: string | null },
): Promise<boolean> {
  const ref = parseScanRef(input.text);
  if (!ref) return false;

  const target = await resolveTarget(supabaseAdmin, ref);
  if (!target) {
    console.warn("[scan-optin] ref did not resolve", { kind: ref.kind });
    return true;
  }

  const now = new Date().toISOString();
  const name = input.profileName?.trim() || null;

  // Customer: the sender's number is the identity.
  const { data: existing } = await supabaseAdmin
    .from("customers")
    .select("id, full_name")
    .eq("retailer_id", target.retailerId)
    .eq("whatsapp_e164", input.from)
    .maybeSingle();

  let customerId: string;
  if (existing) {
    const patch: Record<string, unknown> = { notify_consent_at: now, status: "subscribed" };
    if (!existing.full_name && name) patch.full_name = name;
    await supabaseAdmin.from("customers").update(patch).eq("id", existing.id);
    customerId = existing.id;
  } else {
    const { data: ins, error } = await supabaseAdmin
      .from("customers")
      .insert({
        retailer_id: target.retailerId,
        whatsapp_e164: input.from,
        full_name: name,
        opted_in_at: now,
        notify_consent_at: now,
        status: "subscribed",
        source: "whatsapp_scan",
      })
      .select("id")
      .single();
    if (error || !ins) {
      console.error("[scan-optin] customer insert failed", error?.message);
      return true;
    }
    customerId = ins.id;
  }

  // Interest (one per customer + product).
  const { data: existingInterest } = await supabaseAdmin
    .from("customer_interests")
    .select("id")
    .eq("customer_id", customerId)
    .eq("product_id", target.productId)
    .maybeSingle();
  if (!existingInterest) {
    await supabaseAdmin.from("customer_interests").insert({
      customer_id: customerId,
      product_id: target.productId,
      qr_tag_id: target.qrTagId,
      retailer_id: target.retailerId,
      status: "active",
      source: "scan",
    });
  } else {
    await supabaseAdmin
      .from("customer_interests")
      .update({ status: "active" })
      .eq("id", existingInterest.id);
  }

  // Watch for price/stock changes, baselined on the current values.
  const { data: watched } = await supabaseAdmin
    .from("products")
    .select("price_cents, sale_price_cents, stock_qty, intent_score")
    .eq("id", target.productId)
    .maybeSingle();
  const { createOrRefreshWatch } = await import("@/lib/watch-repository.server");
  try {
    await createOrRefreshWatch(supabaseAdmin, {
      retailerId: target.retailerId,
      customerId,
      productId: target.productId,
      whatsappNumber: input.from,
      active: true,
      product: watched ?? { price_cents: null, sale_price_cents: null, stock_qty: 0, intent_score: 0 },
    });
  } catch (e: any) {
    console.error("[scan-optin] watch activation failed", e?.message ?? e);
  }

  // Inbox conversation, carrying the scanned product.
  let storeName: string | null = null;
  if (target.storeId) {
    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("name")
      .eq("id", target.storeId)
      .maybeSingle();
    storeName = store?.name ?? null;
  }
  const subject = `Interested in ${target.productName}`;
  const scanLine =
    `📷 Scanned ${target.productName}` +
    (storeName ? ` at ${storeName}` : "") +
    ` and started a WhatsApp chat.`;

  const { data: convo } = await supabaseAdmin
    .from("conversations")
    .select("id, tags")
    .eq("customer_id", customerId)
    .eq("retailer_id", target.retailerId)
    .maybeSingle();
  let conversationId: string | undefined = convo?.id;
  if (!conversationId) {
    const { data: created } = await supabaseAdmin
      .from("conversations")
      .insert({
        customer_id: customerId,
        retailer_id: target.retailerId,
        store_id: target.storeId,
        status: "open",
        subject,
        tags: storeName ? [storeName] : [],
      })
      .select("id")
      .single();
    conversationId = created?.id;
  } else {
    const tags = Array.from(new Set([...((convo.tags as string[]) ?? []), ...(storeName ? [storeName] : [])]));
    await supabaseAdmin.from("conversations").update({ subject, tags, status: "open" }).eq("id", conversationId);
  }
  if (conversationId) {
    await supabaseAdmin.from("conversation_messages").insert({
      conversation_id: conversationId,
      retailer_id: target.retailerId,
      direction: "inbound",
      channel: "whatsapp",
      body: scanLine,
      is_internal: false,
      status: "delivered",
      sent_at: now,
    });
  }

  // Confirmation: same automation setting and template as the web opt-in.
  try {
    const { getScanConfirmationSetting } = await import("@/lib/automation.server");
    const setting = await getScanConfirmationSetting(supabaseAdmin, target.retailerId);
    if (!setting.enabled) return true;

    const { sendTemplate } = await import("@/lib/whatsapp-service.server");
    const { isPublicMediaUrl } = await import("@/lib/whatsapp-templates.server");
    const { buildScanTemplateVariables } = await import("@/lib/scan-template.server");

    const headerImage =
      [target.thumbnailUrl, target.imageUrl, target.retailerLogo].find((u) => isPublicMediaUrl(u)) ?? null;

    const result = await sendTemplate({
      templateName: setting.templateName,
      to: input.from,
      headerImageUrl: headerImage,
      variables: buildScanTemplateVariables({
        productName: target.productName,
        priceCents: watched?.sale_price_cents ?? watched?.price_cents ?? null,
        originalPriceCents: watched?.price_cents ?? null,
      }),
    });
    if (!result.ok) console.warn("[scan-optin] confirmation send failed", result.status, result.error);

    await supabaseAdmin.from("notification_history").insert({
      retailer_id: target.retailerId,
      customer_id: customerId,
      channel: "whatsapp",
      payload: {
        type: "qr_scan",
        product_id: target.productId,
        template: setting.templateName,
        body: `Confirmed watch on ${target.productName}.`,
        delivery_diagnostic: result.diagnostic ?? null,
      },
      status: result.ok ? "queued" : "failed",
      sent_at: result.ok ? new Date().toISOString() : null,
      error: result.ok ? null : (result.error ?? "WhatsApp confirmation was rejected"),
      provider_message_sid: result.sid ?? null,
    });
  } catch (e: any) {
    console.warn("[scan-optin] confirmation error", e?.message ?? e);
  }

  return true;
}
