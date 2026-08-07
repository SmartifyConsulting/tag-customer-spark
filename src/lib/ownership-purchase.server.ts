// Server-only helpers behind the TAG-scan purchase workflow.
// One entry point writes purchase + receipt + ownership + warranty together,
// so a future POS, bank or manufacturer feed calls the same code path.

export type PurchaseLine = {
  productId?: string | null;
  name: string;
  brand?: string;
  sku?: string;
  category?: string;
  imageUrl?: string;
  quantity: number;
  unitPriceCents: number;
  warrantyMonths: number;
  returnWindowDays: number;
  serialNumber?: string;
};

export type PurchaseInput = {
  tagId: string;
  storeId?: string | null;
  purchasedAt?: string;
  paymentMethod?: string;
  receiptNumber?: string;
  items: PurchaseLine[];
};

// Product category → household room. Everything else lands in "Home".
export const CATEGORY_ROOM: Record<string, string> = {
  kitchen: "Kitchen",
  appliances: "Kitchen",
  food: "Kitchen",
  electronics: "Lounge",
  tv: "Lounge",
  audio: "Lounge",
  furniture: "Lounge",
  bedding: "Bedroom",
  clothing: "Bedroom",
  apparel: "Bedroom",
  office: "Office",
  computers: "Office",
  stationery: "Office",
  automotive: "Garage",
  tools: "Garage",
  hardware: "Garage",
  garden: "Garden",
  outdoor: "Garden",
};

export const DEFAULT_ROOMS = ["Kitchen", "Lounge", "Bedroom", "Office", "Garage", "Garden"];

export function roomForCategory(category?: string | null): string {
  const key = (category ?? "").trim().toLowerCase();
  return CATEGORY_ROOM[key] ?? "Lounge";
}

/** Make sure the six default rooms exist, and return a name → id map. */
export async function ensureRooms(
  supabase: any,
  retailerId: string,
): Promise<Record<string, string>> {
  const { data: existing } = await supabase
    .from("household_rooms")
    .select("id, name")
    .eq("retailer_id", retailerId);

  const map: Record<string, string> = {};
  for (const r of (existing ?? []) as any[]) map[r.name] = r.id;

  const missing = DEFAULT_ROOMS.filter((n) => !map[n]);
  if (missing.length) {
    const { data: created } = await supabase
      .from("household_rooms")
      .insert(
        missing.map((name, i) => ({
          retailer_id: retailerId,
          name,
          sort_order: DEFAULT_ROOMS.indexOf(name) + i,
        })),
      )
      .select("id, name");
    for (const r of (created ?? []) as any[]) map[r.name] = r.id;
  }
  return map;
}

/**
 * Scan a TAG ID at the till and record the sale. Writes, in one pass:
 * purchase → purchase lines → receipt → owned product per line → warranty
 * (where the line carries a term) → a "Purchased" service event.
 */
export async function recordPurchaseFromTag(
  supabase: any,
  retailerId: string,
  userId: string,
  data: PurchaseInput,
) {
  const tag = data.tagId.trim().toUpperCase();

  let tagRow: any = null;
  const { data: found } = await supabase
    .from("consumer_tag_ids")
    .select("*")
    .eq("retailer_id", retailerId)
    .eq("tag_id", tag)
    .maybeSingle();
  tagRow = found;
  if (!tagRow) {
    const { data: created, error } = await supabase
      .from("consumer_tag_ids")
      .insert({ retailer_id: retailerId, tag_id: tag })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    tagRow = created;
  }

  const total = data.items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
  const receiptNumber =
    data.receiptNumber?.trim() || `RCPT-${Math.floor(100000 + Math.random() * 899999)}`;
  const purchasedAt = data.purchasedAt ?? new Date().toISOString();

  const { data: purchase, error: pErr } = await supabase
    .from("purchases")
    .insert({
      retailer_id: retailerId,
      store_id: data.storeId ?? null,
      tag_ref: tagRow?.id ?? null,
      purchased_at: purchasedAt,
      receipt_number: receiptNumber,
      payment_method: data.paymentMethod ?? null,
      total_cents: total,
      created_by: userId,
    })
    .select("*")
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);

  const { data: items, error: iErr } = await supabase
    .from("purchase_items")
    .insert(
      data.items.map((i) => ({
        retailer_id: retailerId,
        purchase_id: purchase.id,
        product_id: i.productId ?? null,
        name: i.name,
        brand: i.brand ?? null,
        sku: i.sku ?? null,
        category: i.category ?? null,
        image_url: i.imageUrl ?? null,
        quantity: i.quantity,
        unit_price_cents: i.unitPriceCents,
        line_total_cents: i.unitPriceCents * i.quantity,
        warranty_months: i.warrantyMonths,
        return_window_days: i.returnWindowDays,
        serial_number: i.serialNumber ?? null,
      })),
    )
    .select("*");
  if (iErr) throw new Error(iErr.message);

  const { error: rErr } = await supabase.from("receipts").insert({
    retailer_id: retailerId,
    purchase_id: purchase.id,
    receipt_number: receiptNumber,
    issued_at: purchase.purchased_at,
    category: data.items[0]?.category ?? null,
    status: "digital",
  });
  if (rErr) throw new Error(rErr.message);

  const rooms = await ensureRooms(supabase, retailerId);

  // Every line becomes an owned product — ownership is not conditional on a
  // warranty; the warranty record is simply added when the line carries one.
  for (const item of (items ?? []) as any[]) {
    const roomName = roomForCategory(item.category);
    const { data: owned } = await supabase
      .from("owned_products")
      .insert({
        retailer_id: retailerId,
        tag_ref: tagRow?.id ?? null,
        purchase_item_id: item.id,
        product_id: item.product_id,
        room_id: rooms[roomName] ?? null,
        name: item.name,
        brand: item.brand,
        category: item.category ?? "Home",
        image_url: item.image_url,
        serial_number: item.serial_number,
        purchased_at: purchase.purchased_at,
        purchase_price_cents: item.unit_price_cents,
        current_value_cents: item.unit_price_cents,
      })
      .select("id")
      .maybeSingle();
    if (!owned) continue;

    if (item.warranty_months && item.warranty_months > 0) {
      const start = new Date(purchase.purchased_at);
      const end = new Date(start);
      end.setMonth(end.getMonth() + item.warranty_months);
      await supabase.from("warranties").insert({
        retailer_id: retailerId,
        owned_product_id: owned.id,
        period_months: item.warranty_months,
        starts_on: start.toISOString().slice(0, 10),
        expires_on: end.toISOString().slice(0, 10),
        status: "active",
      });
    }

    await supabase.from("service_events").insert({
      retailer_id: retailerId,
      owned_product_id: owned.id,
      kind: "purchase",
      title: "Purchased",
      occurred_at: purchase.purchased_at,
      cost_cents: item.line_total_cents,
    });
  }

  return { id: purchase.id as string, receiptNumber };
}
