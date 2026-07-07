import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TagTier } from "./tier";

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

export const getWorkspaceTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ tier: TagTier; retailerId: string | null }> => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { tier: "starter", retailerId: null };
    const { data } = await supabase
      .from("retailers")
      .select("tier")
      .eq("id", retailerId)
      .maybeSingle();
    return { tier: (data?.tier ?? "starter") as TagTier, retailerId };
  });

export const setWorkspaceTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ tier: z.enum(["go", "starter", "growth", "pro", "enterprise"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Only super_admin or retail_admin may flip tier (dev switch).
    const { data: isSuper } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "super_admin",
    });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "retail_admin",
    });
    if (!isSuper && !isAdmin) throw new Error("Not permitted");
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No workspace");
    const { error } = await supabase
      .from("retailers")
      .update({ tier: data.tier })
      .eq("id", retailerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
