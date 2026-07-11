import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function resolveRetailerId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("retailer_id")
    .eq("user_id", userId)
    .not("retailer_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data?.retailer_id ?? null;
}

export const listCustomers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().trim().optional(),
        segment: z.enum(["all", "registered", "subscribed", "vip", "dormant"]).default("all"),
        letter: z.string().trim().max(3).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(10).max(100).default(25),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { rows: [], total: 0 };

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;

    let q = supabase
      .from("customers")
      .select("id, full_name, whatsapp_e164, status, opted_in_at, notify_consent_at, marketing_consent_at, created_at, viewed_at", { count: "exact" })
      .eq("retailer_id", retailerId)
      .order("viewed_at", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data.segment === "subscribed") q = q.eq("status", "subscribed");
    if (data.segment === "registered") q = q.eq("status", "registered");
    if (data.segment === "dormant") q = q.lte("opted_in_at", new Date(Date.now() - 60 * 86400_000).toISOString());
    if (data.search) q = q.or(`full_name.ilike.%${data.search}%,whatsapp_e164.ilike.%${data.search}%`);
    if (data.letter && data.letter !== "all") {
      if (data.letter === "#") {
        q = q.filter("full_name", "~*", "^[^A-Za-z]");
      } else {
        const L = data.letter.charAt(0);
        q = q.ilike("full_name", `${L}%`);
      }
    }

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r: any) => r.id);
    if (ids.length === 0) return { rows: rows ?? [], total: count ?? 0 };

    const [scans, recoveries, interests] = await Promise.all([
      supabase.from("qr_scans").select("customer_id, scanned_at").in("customer_id", ids),
      supabase.from("sales_recoveries").select("customer_id, amount_cents").in("customer_id", ids),
      supabase.from("customer_interests").select("customer_id").in("customer_id", ids),
    ]);

    const scanCount = new Map<string, number>();
    const lastScan = new Map<string, string>();
    for (const s of (scans.data ?? []) as any[]) {
      scanCount.set(s.customer_id, (scanCount.get(s.customer_id) ?? 0) + 1);
      const prev = lastScan.get(s.customer_id);
      if (!prev || (s.scanned_at && s.scanned_at > prev)) lastScan.set(s.customer_id, s.scanned_at);
    }
    const revenue = new Map<string, number>();
    for (const s of (recoveries.data ?? []) as any[])
      revenue.set(s.customer_id, (revenue.get(s.customer_id) ?? 0) + (s.amount_cents ?? 0));
    const interestCount = new Map<string, number>();
    for (const s of (interests.data ?? []) as any[])
      interestCount.set(s.customer_id, (interestCount.get(s.customer_id) ?? 0) + 1);

    let enriched = (rows ?? []).map((r: any) => ({
      ...r,
      is_new: r.viewed_at == null,
      scans: scanCount.get(r.id) ?? 0,
      interests: interestCount.get(r.id) ?? 0,
      last_scan_at: lastScan.get(r.id) ?? null,
      lifetime_revenue_cents: revenue.get(r.id) ?? 0,
    }));

    if (data.segment === "vip") {
      enriched = enriched.filter((r) => r.lifetime_revenue_cents > 100_000 || r.scans > 5);
    }

    return { rows: enriched, total: count ?? 0 };
  });

export const getCustomerDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: customer, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !customer) throw new Error("Customer not found");

    const [scans, interests, conversations, recoveries, watchlists] = await Promise.all([
      supabase
        .from("qr_scans")
        .select("id, scanned_at, device_type, product:products(name)")
        .eq("customer_id", data.id)
        .order("scanned_at", { ascending: false })
        .limit(50),
      supabase
        .from("customer_interests")
        .select("id, created_at, product:products(id, name, image_url)")
        .eq("customer_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("conversations")
        .select("id, subject, status, last_message_at, unread_count")
        .eq("customer_id", data.id)
        .order("last_message_at", { ascending: false })
        .limit(20),
      supabase
        .from("sales_recoveries")
        .select("id, recovered_at, amount_cents, product:products(name)")
        .eq("customer_id", data.id)
        .order("recovered_at", { ascending: false }),
      supabase
        .from("watchlists")
        .select("id, status, trigger, product:products(name)")
        .eq("customer_id", data.id),
    ]);

    return {
      customer,
      scans: scans.data ?? [],
      interests: interests.data ?? [],
      conversations: conversations.data ?? [],
      recoveries: recoveries.data ?? [],
      watchlists: watchlists.data ?? [],
    };
  });

const customerInputSchema = z.object({
  full_name: z.string().trim().max(120).nullable().optional(),
  whatsapp_e164: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{7,14}$/, "Enter a valid phone number in international format")
    .transform((v) => (v.startsWith("+") ? v : `+${v}`)),
  email: z.string().trim().email().max(200).nullable().optional().or(z.literal("")),
  status: z.enum(["registered", "subscribed", "unsubscribed", "blocked"]).optional(),
  marketing_consent: z.boolean().default(false),
  notify_consent: z.boolean().default(true),
});

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => customerInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer assigned");
    const now = new Date().toISOString();
    // Only mark customers as "subscribed" when they opted in to marketing.
    // Everyone else is "registered" (signed up but not opted in).
    const resolvedStatus = data.status ?? (data.marketing_consent ? "subscribed" : "registered");
    const row: any = {
      retailer_id: retailerId,
      full_name: data.full_name || null,
      whatsapp_e164: data.whatsapp_e164,
      email: data.email || null,
      status: resolvedStatus,
      opted_in_at: now,
      marketing_consent_at: data.marketing_consent ? now : null,
      notify_consent_at: data.notify_consent ? now : null,
    };
    const { data: ins, error } = await supabase
      .from("customers")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins!.id as string };
  });

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), patch: customerInputSchema.partial() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const p = data.patch as any;
    const patch: any = {};
    if (p.full_name !== undefined) patch.full_name = p.full_name || null;
    if (p.whatsapp_e164 !== undefined) patch.whatsapp_e164 = p.whatsapp_e164;
    if (p.email !== undefined) patch.email = p.email || null;
    if (p.status !== undefined) patch.status = p.status;
    if (p.marketing_consent !== undefined) {
      patch.marketing_consent_at = p.marketing_consent ? new Date().toISOString() : null;
      // If status wasn't explicitly set, flip it based on marketing opt-in.
      if (p.status === undefined) {
        patch.status = p.marketing_consent ? "subscribed" : "registered";
      }
    }
    if (p.notify_consent !== undefined)
      patch.notify_consent_at = p.notify_consent ? new Date().toISOString() : null;
    const { error } = await context.supabase.from("customers").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Block hard delete if there are attributed revenue rows
    const { count } = await supabase
      .from("sales_recoveries")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", data.id);
    if ((count ?? 0) > 0) {
      throw new Error("Customer has recovered sales; block instead of deleting.");
    }
    const { error } = await supabase.from("customers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markCustomersViewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).max(100) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.ids.length === 0) return { ok: true };
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { ok: true };
    const { error } = await supabase
      .from("customers")
      .update({ viewed_at: new Date().toISOString() })
      .in("id", data.ids)
      .eq("retailer_id", retailerId)
      .is("viewed_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
