import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveOwnershipContext } from "@/lib/ownership-context.server";
import { FEATURE_MIN_TIER, meetsTier, type TagTier } from "@/lib/tier";

// The single account permitted to flip global feature toggles. This is a
// platform-level kill switch, not a role — no other super_admin or
// retail_admin account can change these, by design.
const SYSTEM_ADMIN_EMAIL = "georgia.adams@smartify.co.za";

export const isSystemAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { claims } = context as any;
    return claims?.email === SYSTEM_ADMIN_EMAIL;
  });

// Receipts is available only when BOTH hold:
//  1. The platform-wide kill switch is on (georgia.adams@smartify.co.za's
//     override — protects control of this module regardless of any
//     retailer's plan).
//  2. The caller's retailer is subscribed to a tier that includes Receipts —
//     shoppers inherit their retailer's subscription; they never pay
//     directly.
async function computeReceiptsEnabled(supabase: any, userId: string): Promise<boolean> {
  const { data: setting } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "receipts_enabled")
    .maybeSingle();
  if ((setting?.value ?? true) === false) return false;

  const { retailerId } = await resolveOwnershipContext(supabase, userId);
  if (!retailerId) return false;

  const { data: retailer } = await supabase
    .from("retailers")
    .select("tier")
    .eq("id", retailerId)
    .maybeSingle();
  const tier = (retailer?.tier ?? "starter") as TagTier;
  return meetsTier(tier, FEATURE_MIN_TIER.receipts);
}

// Used by receipts/purchases/returns data functions to enforce the same
// rule server-side, not just hide the UI.
export async function assertReceiptsEnabled(supabase: any, userId: string): Promise<void> {
  if (!(await computeReceiptsEnabled(supabase, userId))) {
    throw new Error("Receipts is not available for this account.");
  }
}

export const getReceiptsEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    return computeReceiptsEnabled(supabase, userId);
  });

export const setReceiptsEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, claims, userId } = context as any;
    if (claims?.email !== SYSTEM_ADMIN_EMAIL) {
      throw new Error("Only the system administrator can change this setting.");
    }
    const { error } = await supabase.from("system_settings").upsert(
      { key: "receipts_enabled", value: data.enabled, updated_by: userId, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
