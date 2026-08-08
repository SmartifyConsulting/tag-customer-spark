import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─────────────────────────────────────────────────────────────────────────
// Ownership module — Purchase Intelligence + Ownership Intelligence.
// Every read/write is scoped to the caller's retailer (RLS enforces it too);
// rows also carry a TAG ID so a future consumer-facing login can read the
// same records unchanged.
// ─────────────────────────────────────────────────────────────────────────

// Staff resolve their retailer via user_roles. A wallet (customer) account
// has no staff role at all, so it falls back to the same WhatsApp-number
// link Tagged uses: profiles.whatsapp_e164 -> customers.whatsapp_e164 ->
// customers.retailer_id. This is a stopgap, not a real multi-retailer
// consumer identity — see the "Known limitation" note further down.
async function resolveRetailerId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("retailer_id")
    .eq("user_id", userId)
    .not("retailer_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (data?.retailer_id) return data.retailer_id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("whatsapp_e164")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.whatsapp_e164) return null;

  const { data: customer } = await supabase
    .from("customers")
    .select("retailer_id")
    .eq("whatsapp_e164", profile.whatsapp_e164)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return customer?.retailer_id ?? null;
}

function randomTagId() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const suffix =
    letters[Math.floor(Math.random() * letters.length)] +
    letters[Math.floor(Math.random() * letters.length)] +
    Math.floor(10 + Math.random() * 89);
  return `TAG-${digits}-${suffix}`;
}

// ── TAG ID ───────────────────────────────────────────────────────────────

export const getTagIdentity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return null;

    const { data: existing } = await supabase
      .from("consumer_tag_ids")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (existing) return existing;

    const { data: created } = await supabase
      .from("consumer_tag_ids")
      .insert({ retailer_id: retailerId, tag_id: randomTagId(), display_name: "Household" })
      .select("*")
      .maybeSingle();
    return created ?? null;
  });

export const listTagIdentities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return [];
    const { data } = await supabase
      .from("consumer_tag_ids")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at");
    return data ?? [];
  });

// ── Purchases ────────────────────────────────────────────────────────────

const purchaseFilters = z
  .object({
    search: z.string().optional(),
    storeId: z.string().uuid().optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    warrantyExpiring: z.boolean().optional(),
    returned: z.boolean().optional(),
  })
  .default({});

export const listPurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => purchaseFilters.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);

    // For staff: query by retailer_id. For shoppers: query by consumer tag.
    let purchaseQuery = supabase
      .from("purchases")
      .select(
        "*, items:purchase_items(*), receipt:receipts(id, receipt_number, is_favourite, is_archived, category), store:stores(id, name, city)",
      );

    let storesQuery = supabase.from("stores").select("id, name");
    let returnsQuery = supabase.from("product_returns").select("purchase_id, status");

    if (retailerId) {
      // Staff: filter by retailer
      purchaseQuery = purchaseQuery.eq("retailer_id", retailerId);
      storesQuery = storesQuery.eq("retailer_id", retailerId);
      returnsQuery = returnsQuery.eq("retailer_id", retailerId);
    } else {
      // Shopper: filter by consumer tag (tag_ref)
      const { data: tags } = await supabase
        .from("consumer_tag_ids")
        .select("id")
        .eq("customer_id", userId)
        .limit(1)
        .maybeSingle();

      if (!tags?.id) return { purchases: [], stores: [], brands: [], categories: [] };

      purchaseQuery = purchaseQuery.eq("tag_ref", tags.id);
      storesQuery = storesQuery.select("id, name");
      returnsQuery = returnsQuery.eq("tag_ref", tags.id);
    }

    purchaseQuery = purchaseQuery.order("purchased_at", { ascending: false });
    storesQuery = storesQuery.order("name");

    const [{ data: rows }, { data: stores }, { data: returns }] = await Promise.all([
      purchaseQuery,
      storesQuery,
      returnsQuery,
    ]);

    const returnByPurchase = new Map<string, string>();
    for (const r of (returns ?? []) as any[]) returnByPurchase.set(r.purchase_id, r.status);

    const { data: warranties } = await supabase
      .from("warranties")
      .select("expires_on, status, owned:owned_products(purchase_item_id)")
      .eq("retailer_id", retailerId);
    const warrantyByItem = new Map<string, { expires_on: string; status: string }>();
    for (const w of (warranties ?? []) as any[]) {
      const itemId = w.owned?.purchase_item_id;
      if (itemId) warrantyByItem.set(itemId, { expires_on: w.expires_on, status: w.status });
    }

    const brands = new Set<string>();
    const categories = new Set<string>();
    const soon = Date.now() + 60 * 24 * 3600 * 1000;

    let purchases = ((rows ?? []) as any[]).map((p) => {
      const items = (p.items ?? []) as any[];
      for (const i of items) {
        if (i.brand) brands.add(i.brand);
        if (i.category) categories.add(i.category);
      }
      const warrantyDates = items
        .map((i) => warrantyByItem.get(i.id)?.expires_on)
        .filter(Boolean) as string[];
      const nextExpiry = warrantyDates.sort()[0] ?? null;
      return {
        ...p,
        items,
        receipt: Array.isArray(p.receipt) ? p.receipt[0] ?? null : p.receipt,
        returnStatus: returnByPurchase.get(p.id) ?? null,
        warrantyExpiresOn: nextExpiry,
        warrantyExpiringSoon: nextExpiry ? new Date(nextExpiry).getTime() < soon : false,
      };
    });

    const f = data;
    if (f.storeId) purchases = purchases.filter((p) => p.store_id === f.storeId);
    if (f.category)
      purchases = purchases.filter((p) => p.items.some((i: any) => i.category === f.category));
    if (f.brand) purchases = purchases.filter((p) => p.items.some((i: any) => i.brand === f.brand));
    if (f.from) purchases = purchases.filter((p) => p.purchased_at >= f.from!);
    if (f.to) purchases = purchases.filter((p) => p.purchased_at <= f.to!);
    if (f.warrantyExpiring) purchases = purchases.filter((p) => p.warrantyExpiringSoon);
    if (f.returned) purchases = purchases.filter((p) => !!p.returnStatus);
    if (f.search) {
      const q = f.search.toLowerCase();
      purchases = purchases.filter(
        (p) =>
          (p.receipt_number ?? "").toLowerCase().includes(q) ||
          (p.store?.name ?? "").toLowerCase().includes(q) ||
          p.items.some((i: any) =>
            [i.name, i.brand, i.sku, i.gtin].some((v: string | null) =>
              (v ?? "").toLowerCase().includes(q),
            ),
          ),
      );
    }

    return {
      purchases,
      stores: stores ?? [],
      brands: [...brands].sort(),
      categories: [...categories].sort(),
    };
  });

export const getPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return null;

    const { data: purchase } = await supabase
      .from("purchases")
      .select(
        "*, items:purchase_items(*), receipt:receipts(*), store:stores(*), tag:consumer_tag_ids(*)",
      )
      .eq("retailer_id", retailerId)
      .eq("id", data.id)
      .maybeSingle();
    if (!purchase) return null;

    const itemIds = ((purchase.items ?? []) as any[]).map((i) => i.id);
    const [{ data: rets }, { data: owned }] = await Promise.all([
      supabase.from("product_returns").select("*").eq("purchase_id", data.id),
      itemIds.length
        ? supabase
            .from("owned_products")
            .select("id, purchase_item_id, warranties:warranties(*)")
            .in("purchase_item_id", itemIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const warrantyByItem: Record<string, any> = {};
    for (const o of (owned ?? []) as any[]) {
      const w = (o.warranties ?? [])[0];
      if (o.purchase_item_id) warrantyByItem[o.purchase_item_id] = w ?? null;
    }

    return {
      ...purchase,
      receipt: Array.isArray(purchase.receipt) ? purchase.receipt[0] ?? null : purchase.receipt,
      returns: rets ?? [],
      warrantyByItem,
      ownedByItem: Object.fromEntries(
        ((owned ?? []) as any[]).map((o) => [o.purchase_item_id, o.id]),
      ),
    };
  });

const recordPurchaseInput = z.object({
  tagId: z.string().min(3),
  storeId: z.string().uuid().nullable().optional(),
  purchasedAt: z.string().optional(),
  paymentMethod: z.string().optional(),
  receiptNumber: z.string().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid().nullable().optional(),
        name: z.string().min(1),
        brand: z.string().optional(),
        sku: z.string().optional(),
        category: z.string().optional(),
        imageUrl: z.string().optional(),
        quantity: z.number().int().min(1).default(1),
        unitPriceCents: z.number().int().min(0).default(0),
        warrantyMonths: z.number().int().min(0).default(0),
        returnWindowDays: z.number().int().min(0).default(30),
        serialNumber: z.string().optional(),
      }),
    )
    .min(1),
});

export const recordPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => recordPurchaseInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer for this user");
    const { recordPurchaseFromTag } = await import("@/lib/ownership-purchase.server");
    return recordPurchaseFromTag(supabase, retailerId, userId, data as any);
  });

/**
 * The counter flow: staff scan a customer's TAG ID, pick the store and the
 * lines, and this single call writes purchase + receipt + ownership +
 * warranty together.
 */
export const recordPurchaseFromTagScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => recordPurchaseInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer for this user");
    const { recordPurchaseFromTag } = await import("@/lib/ownership-purchase.server");
    return recordPurchaseFromTag(supabase, retailerId, userId, data as any);
  });


// ── Receipts ─────────────────────────────────────────────────────────────

export const listReceipts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return [];
    const [{ data }, { data: returns }, { data: warranties }] = await Promise.all([
      supabase
        .from("receipts")
        .select("*, purchase:purchases(*, store:stores(name), items:purchase_items(*))")
        .eq("retailer_id", retailerId)
        .order("issued_at", { ascending: false }),
      supabase.from("product_returns").select("purchase_id, status").eq("retailer_id", retailerId),
      supabase
        .from("warranties")
        .select("registered_at, owned:owned_products(purchase_item_id)")
        .eq("retailer_id", retailerId)
        .not("registered_at", "is", null),
    ]);

    const returnByPurchase = new Map<string, string>();
    for (const r of (returns ?? []) as any[]) returnByPurchase.set(r.purchase_id, r.status);
    const registeredItems = new Set(
      ((warranties ?? []) as any[]).map((w) => w.owned?.purchase_item_id).filter(Boolean),
    );

    // Derived states always win over the stored issuing state.
    return ((data ?? []) as any[]).map((r) => {
      const ret = returnByPurchase.get(r.purchase_id);
      const items = (r.purchase?.items ?? []) as any[];
      let status = r.status ?? "digital";
      if (items.some((i) => registeredItems.has(i.id))) status = "warranty_registered";
      if (ret === "refunded") status = "refunded";
      else if (ret && ret !== "rejected") status = "returned";
      return { ...r, status };
    });
  });


export const updateReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        isFavourite: z.boolean().optional(),
        isArchived: z.boolean().optional(),
        category: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const patch: Record<string, unknown> = {};
    if (data.isFavourite !== undefined) patch["is_favourite"] = data.isFavourite;
    if (data.isArchived !== undefined) patch["is_archived"] = data.isArchived;
    if (data.category !== undefined) patch["category"] = data.category;
    const { error } = await supabase.from("receipts").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Returns ──────────────────────────────────────────────────────────────

export const listReturns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return [];
    const { data } = await supabase
      .from("product_returns")
      .select("*, item:purchase_items(*), purchase:purchases(receipt_number, purchased_at, store:stores(name))")
      .eq("retailer_id", retailerId)
      .order("requested_at", { ascending: false });
    return data ?? [];
  });

export const startReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        purchaseId: z.string().uuid(),
        purchaseItemId: z.string().uuid(),
        reason: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer for this user");

    const { data: item } = await supabase
      .from("purchase_items")
      .select("*, purchase:purchases(purchased_at)")
      .eq("id", data.purchaseItemId)
      .maybeSingle();
    if (!item) throw new Error("Purchase line not found");

    const purchasedAt = new Date(item.purchase?.purchased_at ?? Date.now());
    const windowEnds = new Date(purchasedAt);
    windowEnds.setDate(windowEnds.getDate() + (item.return_window_days ?? 30));
    const eligible = windowEnds.getTime() >= Date.now();

    const code = `RET-${Math.floor(1000 + Math.random() * 8999)}-${Math.random()
      .toString(36)
      .slice(2, 4)
      .toUpperCase()}`;

    const { data: row, error } = await supabase
      .from("product_returns")
      .insert({
        retailer_id: retailerId,
        purchase_id: data.purchaseId,
        purchase_item_id: data.purchaseItemId,
        status: eligible ? "requested" : "rejected",
        reason: data.reason,
        return_code: code,
        window_ends_on: windowEnds.toISOString().slice(0, 10),
        refund_cents: item.unit_price_cents ?? 0,
      })
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ...row, eligible };
  });

export const updateReturnStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["requested", "in_progress", "approved", "rejected", "refunded"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase
      .from("product_returns")
      .update({
        status: data.status,
        resolved_at: ["approved", "rejected", "refunded"].includes(data.status)
          ? new Date().toISOString()
          : null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Owned products / household ───────────────────────────────────────────

export const listOwnedProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { products: [], rooms: [] };
    const [{ data: products }, { data: rooms }] = await Promise.all([
      supabase
        .from("owned_products")
        .select("*, warranties:warranties(*), room:household_rooms(id, name)")
        .eq("retailer_id", retailerId)
        .order("purchased_at", { ascending: false }),
      supabase
        .from("household_rooms")
        .select("*")
        .eq("retailer_id", retailerId)
        .order("sort_order"),
    ]);
    return {
      products: ((products ?? []) as any[]).map((p) => ({
        ...p,
        warranty: (p.warranties ?? [])[0] ?? null,
      })),
      rooms: rooms ?? [],
    };
  });

export const getOwnedProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return null;
    const { data: product } = await supabase
      .from("owned_products")
      .select(
        "*, room:household_rooms(id, name), warranties:warranties(*, claims:warranty_claims(*)), documents:product_documents(*), events:service_events(*), item:purchase_items(*, purchase:purchases(*, store:stores(*)))",
      )
      .eq("retailer_id", retailerId)
      .eq("id", data.id)
      .maybeSingle();
    if (!product) return null;
    return {
      ...product,
      warranty: (product.warranties ?? [])[0] ?? null,
      events: ((product.events ?? []) as any[]).sort((a, b) =>
        a.occurred_at < b.occurred_at ? 1 : -1,
      ),
    };
  });

export const updateOwnedProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        roomId: z.string().uuid().nullable().optional(),
        condition: z.string().optional(),
        ownershipStatus: z.string().optional(),
        serialNumber: z.string().optional(),
        currentValueCents: z.number().int().min(0).optional(),
        notes: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const patch: Record<string, unknown> = {};
    if (data.roomId !== undefined) patch["room_id"] = data.roomId;
    if (data.condition !== undefined) patch["condition"] = data.condition;
    if (data.ownershipStatus !== undefined) patch["ownership_status"] = data.ownershipStatus;
    if (data.serialNumber !== undefined) patch["serial_number"] = data.serialNumber;
    if (data.currentValueCents !== undefined) patch["current_value_cents"] = data.currentValueCents;
    if (data.notes !== undefined) patch["notes"] = data.notes;
    const { error } = await supabase.from("owned_products").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listWarranties = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return [];
    const { data } = await supabase
      .from("warranties")
      .select("*, product:owned_products(id, name, brand, image_url, category), claims:warranty_claims(*)")
      .eq("retailer_id", retailerId)
      .order("expires_on");
    return data ?? [];
  });

export const registerWarranty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase
      .from("warranties")
      .update({ registered_at: new Date().toISOString(), status: "active" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createWarrantyClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ warrantyId: z.string().uuid(), description: z.string().min(3) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer for this user");
    const { data: warranty } = await supabase
      .from("warranties")
      .select("owned_product_id")
      .eq("id", data.warrantyId)
      .maybeSingle();
    const { error } = await supabase.from("warranty_claims").insert({
      retailer_id: retailerId,
      warranty_id: data.warrantyId,
      description: data.description,
      status: "submitted",
    });
    if (error) throw new Error(error.message);
    if (warranty?.owned_product_id) {
      await supabase.from("service_events").insert({
        retailer_id: retailerId,
        owned_product_id: warranty.owned_product_id,
        kind: "warranty_claim",
        title: "Warranty claim submitted",
        description: data.description,
      });
    }
    return { ok: true };
  });

export const addServiceEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        ownedProductId: z.string().uuid(),
        kind: z.enum(["maintenance", "repair", "software_update", "purchase", "warranty_claim"]),
        title: z.string().min(2),
        description: z.string().optional(),
        costCents: z.number().int().min(0).default(0),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer for this user");
    const { error } = await supabase.from("service_events").insert({
      retailer_id: retailerId,
      owned_product_id: data.ownedProductId,
      kind: data.kind,
      title: data.title,
      description: data.description ?? null,
      cost_cents: data.costCents,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().min(1), sortOrder: z.number().int().default(99) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer for this user");
    const { data: tag } = await supabase
      .from("consumer_tag_ids")
      .select("id")
      .eq("retailer_id", retailerId)
      .limit(1)
      .maybeSingle();
    const { error } = await supabase.from("household_rooms").insert({
      retailer_id: retailerId,
      tag_ref: tag?.id ?? null,
      name: data.name,
      sort_order: data.sortOrder,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── AI ───────────────────────────────────────────────────────────────────

async function callAI<T>(opts: { prompt: string; system?: string; schema: z.ZodType<T> }) {
  const { generateObject } = await import("ai");
  const { getGatewayFromEnv } = await import("./ai-gateway.server");
  const gateway = getGatewayFromEnv();
  try {
    const { object } = await generateObject({
      model: gateway("google/gemini-3-flash-preview"),
      system: opts.system,
      prompt: opts.prompt,
      schema: opts.schema as any,
    });
    return object as T;
  } catch (e: any) {
    const msg = e?.message ?? "AI call failed";
    if (msg.includes("429")) throw new Error("Rate limit hit. Try again in a moment.");
    if (msg.includes("402")) throw new Error("AI credits exhausted. Add credits to keep going.");
    throw new Error(msg);
  }
}

export const summariseReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ receiptId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer for this user");
    const { data: receipt } = await supabase
      .from("receipts")
      .select("*, purchase:purchases(*, store:stores(name), items:purchase_items(name, brand, quantity, line_total_cents))")
      .eq("id", data.receiptId)
      .maybeSingle();
    if (!receipt) throw new Error("Receipt not found");

    const out = await callAI({
      system: "You summarise retail receipts for a consumer in one or two plain sentences.",
      prompt: `Store: ${receipt.purchase?.store?.name ?? "Unknown"}\nDate: ${receipt.issued_at}\nTotal (cents): ${receipt.purchase?.total_cents}\nItems: ${JSON.stringify(receipt.purchase?.items ?? [])}`,
      schema: z.object({ summary: z.string(), category: z.string() }),
    });

    await supabase
      .from("receipts")
      .update({ ai_summary: out.summary, category: receipt.category ?? out.category })
      .eq("id", data.receiptId);
    return out;
  });

export const ownershipInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { insights: [] };

    const [{ data: owned }, { data: items }] = await Promise.all([
      supabase
        .from("owned_products")
        .select("name, brand, category, purchased_at, estimated_lifespan_months, maintenance_due_on, recall_notice, warranties:warranties(expires_on, status)")
        .eq("retailer_id", retailerId),
      supabase
        .from("purchase_items")
        .select("name, brand, quantity, created_at")
        .eq("retailer_id", retailerId)
        .limit(200),
    ]);

    const KINDS = ["duplicate", "replacement", "servicing", "warranty", "recall", "accessory"] as const;
    try {
      const out = await callAI({
        system:
          "You are an ownership assistant. Given a household's owned products and recent purchases, return practical insights as JSON. Never estimate resale value and never suggest trade-ins. Focus on duplicate purchases, replacement timing, servicing, expiring warranties, recall/safety notices, and compatible accessory suggestions. Each insight needs kind (one of duplicate, replacement, servicing, warranty, recall, accessory), title, detail, and optionally product. Return at most 10. If there is nothing useful, return an empty array.",
        prompt: `Today: ${new Date().toISOString().slice(0, 10)}\nOwned products: ${JSON.stringify(owned ?? [])}\nRecent purchase lines: ${JSON.stringify(items ?? [])}`,
        schema: z.object({
          insights: z.array(
            z.object({
              kind: z.string(),
              title: z.string(),
              detail: z.string(),
              product: z.string().nullable().optional(),
            }),
          ),
        }),
      });
      const insights = (out.insights ?? []).slice(0, 10).map((i) => ({
        kind: (KINDS as readonly string[]).includes(i.kind) ? i.kind : "replacement",
        title: i.title,
        detail: i.detail,
        product: i.product ?? undefined,
      }));
      return { insights };
    } catch {
      // AI output can occasionally miss the schema — degrade to no insights instead of breaking the page.
      return { insights: [] as Array<{ kind: string; title: string; detail: string; product?: string }> };
    }

  });

export const suggestAccessories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ ownedProductId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { data: product } = await supabase
      .from("owned_products")
      .select("name, brand, category")
      .eq("id", data.ownedProductId)
      .maybeSingle();
    if (!product) throw new Error("Product not found");
    return callAI({
      system:
        "Suggest genuinely compatible accessories and consumables for an owned product. No resale or trade-in suggestions.",
      prompt: `Product: ${product.brand ?? ""} ${product.name} (${product.category})`,
      schema: z.object({
        accessories: z
          .array(z.object({ name: z.string(), reason: z.string() }))
          .max(6),
      }),
    });
  });

// ── Insurance / tax export ───────────────────────────────────────────────

export const exportInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return [];
    const { data } = await supabase
      .from("owned_products")
      .select(
        "name, brand, category, serial_number, condition, purchased_at, purchase_price_cents, current_value_cents, image_url, room:household_rooms(name), warranties:warranties(expires_on), item:purchase_items(purchase:purchases(receipt_number))",
      )
      .eq("retailer_id", retailerId)
      .order("category");
    return ((data ?? []) as any[]).map((p) => ({
      name: p.name,
      brand: p.brand ?? "",
      category: p.category,
      room: p.room?.name ?? "",
      serial_number: p.serial_number ?? "",
      condition: p.condition,
      purchased_at: p.purchased_at ? String(p.purchased_at).slice(0, 10) : "",
      purchase_value: (p.purchase_price_cents ?? 0) / 100,
      current_value: (p.current_value_cents ?? 0) / 100,
      warranty_expires: (p.warranties ?? [])[0]?.expires_on ?? "",
      receipt_number: p.item?.purchase?.receipt_number ?? "",
      photo: p.image_url ?? "",
    }));
  });

// ── Documents ────────────────────────────────────────────────────────────
// Manuals, invoices, warranty certificates and service notes attached to
// owned products. The OWNERSHIP section surfaces these in one place so a
// shopper never hunts through individual product pages.

export const listOwnershipDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return [];
    const { data } = await supabase
      .from("product_documents")
      .select("*, product:owned_products(id, name, brand, category, image_url)")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

// ── Receipt status ───────────────────────────────────────────────────────
// The stored status is the issuing state (paper / digital / synced / pending
// / failed). Returned, refunded and warranty-registered are derived from the
// linked records so the badge can never drift from reality.

export const setReceiptStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["paper", "digital", "synced", "pending", "failed"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase
      .from("receipts")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ── Receipt / adoption KPIs ──────────────────────────────────────────────

export const receiptKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return null;

    const [{ data: receipts }, { data: tags }, { count: customerCount }] = await Promise.all([
      supabase.from("receipts").select("id, status, purchase_id").eq("retailer_id", retailerId),
      supabase.from("consumer_tag_ids").select("id").eq("retailer_id", retailerId),
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("retailer_id", retailerId),
    ]);

    const all = (receipts ?? []) as any[];
    const digital = all.filter((r) => r.status !== "paper").length;
    const tagCustomers = (tags ?? []).length;
    const customers = customerCount ?? 0;

    return {
      digitalReceiptsIssued: digital,
      paperReceiptsAvoided: digital,
      customersUsingTag: tagCustomers,
      averageReceiptsPerCustomer: tagCustomers ? +(all.length / tagCustomers).toFixed(1) : 0,
      digitalAdoptionRate: customers ? Math.round((tagCustomers / customers) * 100) : 0,
    };
  });

// ── Ownership on a catalogue product ─────────────────────────────────────

export const productOwnershipSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return null;

    const [{ data: items }, { data: owned }] = await Promise.all([
      supabase
        .from("purchase_items")
        .select("id, quantity, purchase:purchases(id, receipt_number)")
        .eq("retailer_id", retailerId)
        .eq("product_id", data.productId),
      supabase
        .from("owned_products")
        .select("id, current_value_cents, purchase_price_cents, warranties:warranties(expires_on)")
        .eq("retailer_id", retailerId)
        .eq("product_id", data.productId),
    ]);

    const lines = (items ?? []) as any[];
    const ownedRows = (owned ?? []) as any[];
    const now = Date.now();
    const remaining = ownedRows
      .map((o) => (o.warranties ?? [])[0]?.expires_on)
      .filter(Boolean)
      .map((d: string) => Math.round((new Date(d).getTime() - now) / 86400000))
      .filter((d: number) => d > 0);

    return {
      unitsPurchased: lines.reduce((s, l) => s + (l.quantity ?? 0), 0),
      unitsOwned: ownedRows.length,
      receiptsAvailable: new Set(lines.map((l) => l.purchase?.id).filter(Boolean)).size,
      averageWarrantyDaysRemaining: remaining.length
        ? Math.round(remaining.reduce((s: number, d: number) => s + d, 0) / remaining.length)
        : 0,
      currentValueCents: ownedRows.reduce(
        (s, o) => s + (o.current_value_cents ?? o.purchase_price_cents ?? 0),
        0,
      ),
    };
  });

// ── Client profile tabs ──────────────────────────────────────────────────

export const clientOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ customerId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) {
      return { tagIds: [], purchases: [], receipts: [], owned: [], returns: [], warranties: [] };
    }

    const { data: tags } = await supabase
      .from("consumer_tag_ids")
      .select("id, tag_id")
      .eq("retailer_id", retailerId)
      .eq("customer_id", data.customerId);

    const tagRefs = ((tags ?? []) as any[]).map((t) => t.id);
    if (!tagRefs.length) {
      return { tagIds: [], purchases: [], receipts: [], owned: [], returns: [], warranties: [] };
    }

    const [{ data: purchases }, { data: owned }] = await Promise.all([
      supabase
        .from("purchases")
        .select(
          "*, items:purchase_items(*), receipt:receipts(*), store:stores(name)",
        )
        .eq("retailer_id", retailerId)
        .in("tag_ref", tagRefs)
        .order("purchased_at", { ascending: false }),
      supabase
        .from("owned_products")
        .select("*, warranties:warranties(*), room:household_rooms(name)")
        .eq("retailer_id", retailerId)
        .in("tag_ref", tagRefs)
        .order("purchased_at", { ascending: false }),
    ]);

    const purchaseRows = (purchases ?? []) as any[];
    const purchaseIds = purchaseRows.map((p) => p.id);
    const { data: returns } = purchaseIds.length
      ? await supabase
          .from("product_returns")
          .select("*, item:purchase_items(name)")
          .in("purchase_id", purchaseIds)
      : { data: [] as any[] };

    const ownedRows = (owned ?? []) as any[];

    return {
      tagIds: (tags ?? []) as any[],
      purchases: purchaseRows,
      receipts: purchaseRows
        .map((p) => ({
          ...(Array.isArray(p.receipt) ? p.receipt[0] ?? {} : p.receipt ?? {}),
          purchase: { id: p.id, purchased_at: p.purchased_at, total_cents: p.total_cents },
        }))
        .filter((r) => r.id),
      owned: ownedRows.map((o) => ({ ...o, warranty: (o.warranties ?? [])[0] ?? null })),
      returns: (returns ?? []) as any[],
      warranties: ownedRows
        .flatMap((o) => (o.warranties ?? []).map((w: any) => ({ ...w, product: o })))
        .sort((a: any, b: any) => (a.expires_on < b.expires_on ? -1 : 1)),
    };
  });

// ── Household rooms ──────────────────────────────────────────────────────

export const moveOwnedProductToRoom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), roomId: z.string().uuid().nullable() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    const { error } = await supabase
      .from("owned_products")
      .update({ room_id: data.roomId })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Create the six default rooms and file any unassigned item by category. */
export const autoAssignRooms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { moved: 0 };
    const { ensureRooms, roomForCategory } = await import("@/lib/ownership-purchase.server");
    const rooms = await ensureRooms(supabase, retailerId);

    const { data: unassigned } = await supabase
      .from("owned_products")
      .select("id, category")
      .eq("retailer_id", retailerId)
      .is("room_id", null);

    let moved = 0;
    for (const p of (unassigned ?? []) as any[]) {
      const roomId = rooms[roomForCategory(p.category)];
      if (!roomId) continue;
      await supabase.from("owned_products").update({ room_id: roomId }).eq("id", p.id);
      moved += 1;
    }
    return { moved };
  });

// ── Global search ────────────────────────────────────────────────────────

export const globalOwnershipSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return [];
    const q = data.q.trim();
    const like = `%${q}%`;

    const [products, receipts, purchases, customers, stores, owned, returns] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, brand_name, sku")
        .eq("retailer_id", retailerId)
        .or(`name.ilike.${like},sku.ilike.${like}`)
        .limit(8),
      supabase
        .from("receipts")
        .select("id, receipt_number, issued_at, status, purchase_id")
        .eq("retailer_id", retailerId)
        .ilike("receipt_number", like)
        .limit(8),
      supabase
        .from("purchases")
        .select("id, receipt_number, purchased_at, total_cents")
        .eq("retailer_id", retailerId)
        .ilike("receipt_number", like)
        .limit(8),
      supabase
        .from("customers")
        .select("id, full_name, phone")
        .eq("retailer_id", retailerId)
        .or(`full_name.ilike.${like},phone.ilike.${like}`)
        .limit(8),
      supabase
        .from("stores")
        .select("id, name, city")
        .eq("retailer_id", retailerId)
        .ilike("name", like)
        .limit(6),
      supabase
        .from("owned_products")
        .select("id, name, brand, serial_number")
        .eq("retailer_id", retailerId)
        .or(`name.ilike.${like},serial_number.ilike.${like}`)
        .limit(8),
      supabase
        .from("product_returns")
        .select("id, return_code, status")
        .eq("retailer_id", retailerId)
        .ilike("return_code", like)
        .limit(6),
    ]);

    type Hit = { kind: string; id: string; title: string; subtitle: string; to: string };
    const hits: Hit[] = [];
    for (const p of (products.data ?? []) as any[])
      hits.push({
        kind: "Product",
        id: p.id,
        title: p.name,
        subtitle: [p.brand_name, p.sku].filter(Boolean).join(" · "),
        to: `/products/${p.id}`,
      });
    for (const r of (receipts.data ?? []) as any[])
      hits.push({
        kind: "Receipt",
        id: r.id,
        title: r.receipt_number,
        subtitle: new Date(r.issued_at).toLocaleDateString(),
        to: `/purchase/receipts`,
      });
    for (const p of (purchases.data ?? []) as any[])
      hits.push({
        kind: "Purchase",
        id: p.id,
        title: p.receipt_number ?? "Purchase",
        subtitle: new Date(p.purchased_at).toLocaleDateString(),
        to: `/ownership/purchases/${p.id}`,
      });
    for (const c of (customers.data ?? []) as any[])
      hits.push({
        kind: "Customer",
        id: c.id,
        title: c.full_name ?? c.phone ?? "Customer",
        subtitle: c.phone ?? "",
        to: `/customers`,
      });
    for (const s of (stores.data ?? []) as any[])
      hits.push({ kind: "Store", id: s.id, title: s.name, subtitle: s.city ?? "", to: `/stores` });
    for (const o of (owned.data ?? []) as any[])
      hits.push({
        kind: "Owned product",
        id: o.id,
        title: o.name,
        subtitle: [o.brand, o.serial_number].filter(Boolean).join(" · "),
        to: `/ownership/products/${o.id}`,
      });
    for (const r of (returns.data ?? []) as any[])
      hits.push({
        kind: "Return",
        id: r.id,
        title: r.return_code,
        subtitle: r.status,
        to: `/ownership/returns`,
      });

    return hits;
  });

// ── Lifecycle alerts ─────────────────────────────────────────────────────
// Deterministic, no AI: receipt received, warranty expiring, return window
// ending, price drop after purchase, product recall.

export const lifecycleAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return [];

    const now = Date.now();
    const [{ data: receipts }, { data: owned }, { data: items }] = await Promise.all([
      supabase
        .from("receipts")
        .select("id, receipt_number, issued_at")
        .eq("retailer_id", retailerId)
        .order("issued_at", { ascending: false })
        .limit(5),
      supabase
        .from("owned_products")
        .select("id, name, recall_notice, warranties:warranties(expires_on)")
        .eq("retailer_id", retailerId),
      supabase
        .from("purchase_items")
        .select(
          "id, name, unit_price_cents, return_window_days, product_id, purchase:purchases(purchased_at), product:products(price_cents, sale_price_cents)",
        )
        .eq("retailer_id", retailerId)
        .limit(300),
    ]);

    type Alert = { kind: string; title: string; detail: string; tone: "ok" | "soon" | "expired" | "info" };
    const alerts: Alert[] = [];

    for (const r of (receipts ?? []) as any[]) {
      const age = (now - new Date(r.issued_at).getTime()) / 86400000;
      if (age <= 3) {
        alerts.push({
          kind: "Receipt received",
          title: r.receipt_number,
          detail: `Issued ${new Date(r.issued_at).toLocaleDateString()}`,
          tone: "ok",
        });
      }
    }

    for (const o of (owned ?? []) as any[]) {
      const expires = (o.warranties ?? [])[0]?.expires_on;
      if (expires) {
        const days = Math.round((new Date(expires).getTime() - now) / 86400000);
        if (days >= 0 && days <= 30) {
          alerts.push({
            kind: "Warranty expiring",
            title: o.name,
            detail: `${days} day(s) of cover left`,
            tone: "soon",
          });
        }
      }
      if (o.recall_notice) {
        alerts.push({
          kind: "Product recall",
          title: o.name,
          detail: o.recall_notice,
          tone: "expired",
        });
      }
    }

    for (const i of (items ?? []) as any[]) {
      const purchasedAt = i.purchase?.purchased_at ? new Date(i.purchase.purchased_at).getTime() : null;
      if (purchasedAt) {
        const endsIn = Math.round(
          (purchasedAt + (i.return_window_days ?? 30) * 86400000 - now) / 86400000,
        );
        if (endsIn >= 0 && endsIn <= 5) {
          alerts.push({
            kind: "Return window ending",
            title: i.name,
            detail: `${endsIn} day(s) left to return`,
            tone: "soon",
          });
        }
      }
      const nowPrice = i.product?.sale_price_cents ?? i.product?.price_cents;
      if (nowPrice && i.unit_price_cents && nowPrice < i.unit_price_cents) {
        alerts.push({
          kind: "Price drop after purchase",
          title: i.name,
          detail: `Now ${((i.unit_price_cents - nowPrice) / 100).toFixed(2)} cheaper than you paid`,
          tone: "info",
        });
      }
    }

    return alerts.slice(0, 20);
  });

// ─── Outlets (Shopper's registered stores) ───────────────────────────────

export const listUserOutlets = createServerFn({ method: "POST" })(async () => {
  const { supabase, userId } = await requireSupabaseAuth();
  const { data } = await supabase
    .from("shopper_outlets")
    .select(`
      outlet_id,
      outlets (
        id,
        name,
        location
      )
    `)
    .eq("shopper_id", userId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row: any) => row.outlets).filter(Boolean);
});

export const listAllOutlets = createServerFn({ method: "POST" })(async (opts: { data: { search?: string } }) => {
  const { supabase } = await requireSupabaseAuth();
  let query = supabase.from("outlets").select("id, name, location");

  if (opts.data.search) {
    query = query.ilike("name", `%${opts.data.search}%`);
  }

  const { data } = await query.order("name", { ascending: true }).limit(50);
  return data ?? [];
});

export const addOutletToUser = createServerFn({ method: "POST" })(async (opts: { data: { outlet_id: string } }) => {
  const { supabase, userId } = await requireSupabaseAuth();
  const { error } = await supabase.from("shopper_outlets").insert({
    shopper_id: userId,
    outlet_id: opts.data.outlet_id,
  });

  if (error) throw error;
});

export const removeOutletFromUser = createServerFn({ method: "POST" })(async (opts: { data: { outlet_id: string } }) => {
  const { supabase, userId } = await requireSupabaseAuth();
  const { error } = await supabase
    .from("shopper_outlets")
    .delete()
    .eq("shopper_id", userId)
    .eq("outlet_id", opts.data.outlet_id);

  if (error) throw error;
});

// Admin function to link a user by email to an outlet by name
export const setupOutletLinkByEmail = createServerFn({ method: "POST" })(async (opts: { data: { email: string; outletName: string } }) => {
  const { supabase } = await requireSupabaseAuth();

  // Find user by email
  const { data: user } = await supabase.from("profiles").select("id").eq("email", opts.data.email).maybeSingle();
  if (!user?.id) throw new Error(`User not found: ${opts.data.email}`);

  // Find or create outlet
  let outlet = await supabase
    .from("outlets")
    .select("id")
    .ilike("name", opts.data.outletName)
    .maybeSingle();

  if (!outlet.data?.id) {
    const { data: created } = await supabase
      .from("outlets")
      .insert({ name: opts.data.outletName, location: "South Africa" })
      .select("id")
      .maybeSingle();
    if (!created?.id) throw new Error("Failed to create outlet");
    outlet = { data: created };
  }

  // Link user to outlet
  const { error } = await supabase.from("shopper_outlets").upsert(
    {
      shopper_id: user.id,
      outlet_id: outlet.data.id,
    },
    { onConflict: "shopper_id,outlet_id" },
  );

  if (error) throw error;
  return { userId: user.id, outletId: outlet.data.id };
});
