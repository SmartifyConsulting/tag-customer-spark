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

export const listAutomationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { activeWhatsAppProvider } = await import("@/lib/whatsapp.server");
    const provider = activeWhatsAppProvider();

    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { settings: [], provider };

    const { getAutomationSettingsList } = await import("@/lib/automation.server");
    return { settings: await getAutomationSettingsList(supabase, retailerId), provider };
  });

export const saveAutomationSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        automation_key: z.enum([
          "price_drop",
          "low_stock",
          "last_one",
          "back_in_stock",
          "high_interest",
          "daily_summary",
        ]),
        enabled: z.boolean(),
        threshold: z.number().nullable().optional(),
        template_name: z.string().trim().min(1).max(120),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No workspace found");

    const { upsertAutomationSetting } = await import("@/lib/automation.server");
    await upsertAutomationSetting(supabase, retailerId, {
      automation_key: data.automation_key,
      enabled: data.enabled,
      threshold: data.threshold ?? null,
      template_name: data.template_name,
    });
    return { ok: true };
  });
