import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ─────────────────────────────────────────────────────────────────────────
// Ownership module — Purchase Intelligence + Ownership Intelligence.
// Every read/write is scoped to the caller's retailer (RLS enforces it too);
// rows also carry a TAG ID so a future consumer-facing login can read the
// same records unchanged.
// ─────────────────────────────────────────────────────────────────────────

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
    if (!retailerId) return { purchases: [], stores: [], brands: [], categories: [] };

    const [{ data: rows }, { data: stores }, { data: returns }] = await Promise.all([
      supabase
        .from("purchases")
        .select(
          "*, items:purchase_items(*), receipt:receipts(id, receipt_number, is_favourite, is_archived, category), store:stores(id, name, city)",
        )
        .eq("retailer_id", retailerId)
        .order("purchased_at", { ascending: false }),
      supabase.from("stores").select("id, name").eq("retailer_id", retailerId).order("name"),
      supabase.from("product_returns").select("purchase_id, status").eq("retailer_id", retailerId),
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

    // Resolve (or create) the TAG ID this purchase belongs to.
    let tagRow: any = null;
    const { data: found } = await supabase
      .from("consumer_tag_ids")
      .select("*")
      .eq("retailer_id", retailerId)
      .eq("tag_id", data.tagId.trim().toUpperCase())
      .maybeSingle();
    tagRow = found;
    if (!tagRow) {
      const { data: created, error } = await supabase
        .from("consumer_tag_ids")
        .insert({ retailer_id: retailerId, tag_id: data.tagId.trim().toUpperCase() })
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      tagRow = created;
    }

    const total = data.items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
    const receiptNumber =
      data.receiptNumber?.trim() || `RCPT-${Math.floor(100000 + Math.random() * 899999)}`;

    const { data: purchase, error: pErr } = await supabase
      .from("purchases")
      .insert({
        retailer_id: retailerId,
        store_id: data.storeId ?? null,
        tag_ref: tagRow?.id ?? null,
        purchased_at: data.purchasedAt ?? new Date().toISOString(),
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

    await supabase.from("receipts").insert({
      retailer_id: retailerId,
      purchase_id: purchase.id,
      receipt_number: receiptNumber,
      issued_at: purchase.purchased_at,
      category: data.items[0]?.category ?? null,
    });

    // Anything with a warranty becomes an owned product with a live warranty
    // record — that's the bridge from purchase to ownership.
    for (const item of (items ?? []) as any[]) {
      if (!item.warranty_months || item.warranty_months <= 0) continue;
      const { data: owned } = await supabase
        .from("owned_products")
        .insert({
          retailer_id: retailerId,
          tag_ref: tagRow?.id ?? null,
          purchase_item_id: item.id,
          product_id: item.product_id,
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
      if (owned) {
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
        await supabase.from("service_events").insert({
          retailer_id: retailerId,
          owned_product_id: owned.id,
          kind: "purchase",
          title: "Purchased",
          occurred_at: purchase.purchased_at,
          cost_cents: item.line_total_cents,
        });
      }
    }

    return { id: purchase.id as string, receiptNumber };
  });

// ── Receipts ─────────────────────────────────────────────────────────────

export const listReceipts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return [];
    const { data } = await supabase
      .from("receipts")
      .select("*, purchase:purchases(*, store:stores(name), items:purchase_items(*))")
      .eq("retailer_id", retailerId)
      .order("issued_at", { ascending: false });
    return data ?? [];
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

    const out = await callAI({
      system:
        "You are an ownership assistant. Given a household's owned products and recent purchases, return practical insights. Never estimate resale value and never suggest trade-ins. Focus on duplicate purchases, replacement timing, servicing, expiring warranties, recall/safety notices, and compatible accessory suggestions.",
      prompt: `Today: ${new Date().toISOString().slice(0, 10)}\nOwned products: ${JSON.stringify(owned ?? [])}\nRecent purchase lines: ${JSON.stringify(items ?? [])}`,
      schema: z.object({
        insights: z
          .array(
            z.object({
              kind: z.enum([
                "duplicate",
                "replacement",
                "servicing",
                "warranty",
                "recall",
                "accessory",
              ]),
              title: z.string(),
              detail: z.string(),
              product: z.string().optional(),
            }),
          )
          .max(10),
      }),
    });
    return out;
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
