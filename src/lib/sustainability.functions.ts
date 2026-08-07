import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const periodInput = z.object({
  period: z
    .enum(["today", "week", "month", "quarter", "year", "since", "custom"])
    .default("since"),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const getSustainabilityOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => periodInput.parse(d))
  .handler(async ({ data, context }) => {
    const { buildOverview } = await import("./sustainability.server");
    const { supabase, userId } = context as any;
    return buildOverview(supabase, userId, data);
  });

export const getSustainabilitySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadSettings, resolveRetailerId } = await import("./sustainability.server");
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return null;
    return loadSettings(supabase, retailerId);
  });

export const updateSustainabilitySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        enabled: z.boolean().optional(),
        demo_mode: z.boolean().optional(),
        avg_receipt_length_cm: z.number().optional(),
        avg_receipt_weight_g: z.number().optional(),
        cost_per_receipt_cents: z.number().optional(),
        printer_maintenance_cents_per_1000: z.number().optional(),
        ink_cents_per_1000: z.number().optional(),
        electricity_cents_per_kwh: z.number().optional(),
        energy_kwh_per_1000_receipts: z.number().optional(),
        co2_kg_per_kg_paper: z.number().optional(),
        water_l_per_kg_paper: z.number().optional(),
        currency: z.string().optional(),
        units: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveRetailerId } = await import("./sustainability.server");
    const { supabase, userId } = context as any;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer for this user");
    const { error } = await supabase
      .from("sustainability_settings")
      .upsert({ retailer_id: retailerId, ...data }, { onConflict: "retailer_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSustainabilityInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => periodInput.parse(d))
  .handler(async ({ data, context }) => {
    const { buildOverview } = await import("./sustainability.server");
    const { supabase, userId } = context as any;
    const overview = await buildOverview(supabase, userId, data);
    if (!overview.hasRetailerContext) return { insights: [] as { title: string; detail: string }[] };

    const { generateObject } = await import("ai");
    const { getGatewayFromEnv } = await import("./ai-gateway.server");
    try {
      const { object } = await generateObject({
        model: getGatewayFromEnv()("google/gemini-3-flash-preview"),
        system:
          "You are an ESG analyst for a retail group. Write short, concrete executive observations about digital receipt adoption and sustainability. No fluff, no emojis.",
        prompt: `Reporting period: ${overview.periodLabel}
Digital receipts: ${overview.receipts.total} (${overview.receipts.digitalSharePct}% of transactions, ${overview.receipts.growthPct}% vs previous period)
Paper avoided: ${overview.paper.kilograms} kg, CO2e avoided: ${overview.environment.co2Kg} kg, water saved: ${overview.environment.waterLitres} L
Cost saved: ${(overview.cost.totalCents / 100).toFixed(0)} ${overview.currency} (annualised ${(overview.cost.annualisedCents / 100).toFixed(0)})
Stores: ${JSON.stringify(overview.stores.slice(0, 15).map((s) => ({ name: s.name, adoption: s.adoptionPct, receipts: s.digitalReceipts })))}
Funnel: ${JSON.stringify(overview.funnel)}
Give 4-6 observations: low-adoption outliers, the estimated annual saving if adoption rose 10 percentage points, trends, customer adoption opportunities, and one recommended campaign.`,
        schema: z.object({
          insights: z.array(z.object({ title: z.string(), detail: z.string() })).min(3).max(6),
        }) as any,
      });
      return object as { insights: { title: string; detail: string }[] };
    } catch (e: any) {
      const msg = e?.message ?? "AI unavailable";
      return { insights: [], error: msg.includes("429") ? "Rate limited — try again shortly." : msg };
    }
  });
