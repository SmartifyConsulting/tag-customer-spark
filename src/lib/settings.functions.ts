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

export const getWorkspaceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return null;

    const [retailer, roi, subscription] = await Promise.all([
      supabase.from("retailers").select("*").eq("id", retailerId).maybeSingle(),
      supabase.from("roi_settings").select("*").eq("retailer_id", retailerId).maybeSingle(),
      supabase.from("subscriptions").select("*").eq("retailer_id", retailerId).maybeSingle(),
    ]);

    return {
      retailer: retailer.data,
      roi: roi.data,
      subscription: subscription.data,
    };
  });

export const updateRetailerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        contact_email: z.string().email().optional().nullable(),
        logo_url: z.string().url().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");
    const { error } = await supabase.from("retailers").update(data).eq("id", retailerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return [];
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });
