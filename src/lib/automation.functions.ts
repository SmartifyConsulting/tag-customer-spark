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
    if (!retailerId) return { settings: [], provider, lastFailure: null };

    const { getAutomationSettingsList } = await import("@/lib/automation.server");

    // Surface the most recent delivery failure so a broken sender/API key is
    // visible here instead of showing up as silence on the customer's phone.
    const [settings, { data: lastSent }, { data: lastFailed }] = await Promise.all([
      getAutomationSettingsList(supabase, retailerId),
      supabase
        .from("notification_history")
        .select("created_at")
        .eq("retailer_id", retailerId)
        .eq("status", "sent")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("notification_history")
        .select("created_at, error, payload")
        .eq("retailer_id", retailerId)
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    // Only warn when the failure is the LATEST outcome — an old failure that a
    // later successful send has superseded is noise.
    const stillBroken =
      lastFailed &&
      (!lastSent || new Date(lastFailed.created_at) > new Date(lastSent.created_at));

    return {
      settings,
      provider,
      lastFailure: stillBroken
        ? {
            at: lastFailed.created_at as string,
            error: (lastFailed.error as string) ?? "Unknown error",
            template: ((lastFailed.payload as any)?.template as string) ?? null,
          }
        : null,
    };
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
