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
        segment: z.enum(["all", "subscribed", "vip", "dormant"]).default("all"),
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
      .select("id, full_name, whatsapp_e164, status, opted_in_at, notify_consent_at, marketing_consent_at, created_at", { count: "exact" })
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data.segment === "subscribed") q = q.eq("status", "subscribed");
    if (data.segment === "dormant") q = q.lte("opted_in_at", new Date(Date.now() - 60 * 86400_000).toISOString());
    if (data.search) q = q.or(`full_name.ilike.%${data.search}%,whatsapp_e164.ilike.%${data.search}%`);

    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r: any) => r.id);
    if (ids.length === 0) return { rows: rows ?? [], total: count ?? 0 };

    const [scans, recoveries, interests] = await Promise.all([
      supabase.from("qr_scans").select("customer_id").in("customer_id", ids),
      supabase.from("sales_recoveries").select("customer_id, amount_cents").in("customer_id", ids),
      supabase.from("customer_interests").select("customer_id").in("customer_id", ids),
    ]);

    const scanCount = new Map<string, number>();
    for (const s of (scans.data ?? []) as any[])
      scanCount.set(s.customer_id, (scanCount.get(s.customer_id) ?? 0) + 1);
    const revenue = new Map<string, number>();
    for (const s of (recoveries.data ?? []) as any[])
      revenue.set(s.customer_id, (revenue.get(s.customer_id) ?? 0) + (s.amount_cents ?? 0));
    const interestCount = new Map<string, number>();
    for (const s of (interests.data ?? []) as any[])
      interestCount.set(s.customer_id, (interestCount.get(s.customer_id) ?? 0) + 1);

    let enriched = (rows ?? []).map((r: any) => ({
      ...r,
      scans: scanCount.get(r.id) ?? 0,
      interests: interestCount.get(r.id) ?? 0,
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
