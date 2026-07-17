import { createServerFn } from "@tanstack/react-start";
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

// Small, dedicated query (just name + logo) so every authenticated page can
// cheaply pull branding without paying for the full getWorkspaceSettings
// payload (roi_settings, subscription, etc.) on every load.
export const getRetailerBranding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { name: null, logo_url: null };
    const { data } = await supabase
      .from("retailers")
      .select("name, logo_url")
      .eq("id", retailerId)
      .maybeSingle();
    return { name: data?.name ?? null, logo_url: data?.logo_url ?? null };
  });
