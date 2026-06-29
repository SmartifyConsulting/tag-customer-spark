import { createFileRoute } from "@tanstack/react-router";

// Cron hook: drains intent_recompute_queue and refreshes forecasts.
// Also runs the daily AI brief once per UTC day per retailer.

export const Route = createFileRoute("/api/public/hooks/intent-tick")({
  server: {
    handlers: {
      POST: handler,
      GET: handler,
    },
  },
});

async function handler() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1) Drain recompute queue (up to 200 products per tick)
  const { data: queued } = await supabaseAdmin
    .from("intent_recompute_queue")
    .select("product_id")
    .order("enqueued_at", { ascending: true })
    .limit(200);

  const recomputed: string[] = [];
  for (const row of queued ?? []) {
    try {
      await supabaseAdmin.rpc("recompute_product_intent", { _product_id: row.product_id });
      await supabaseAdmin.rpc("forecast_product_intent", { _product_id: row.product_id });
      recomputed.push(row.product_id);
    } catch (e) {
      // leave in queue, continue
    }
  }

  // 2) Daily AI brief per retailer, if today's brief hasn't been generated.
  const briefedRetailers: string[] = [];
  try {
    const { data: retailers } = await supabaseAdmin.from("retailers").select("id");
    const todayStart = new Date(); todayStart.setUTCHours(0,0,0,0);
    const { runDailyBriefForRetailer } = await import("@/lib/ai-jobs.server");

    for (const r of retailers ?? []) {
      const { data: existing } = await supabaseAdmin
        .from("ai_insights")
        .select("id")
        .eq("retailer_id", r.id)
        .eq("kind", "executive_summary")
        .gte("generated_at", todayStart.toISOString())
        .limit(1)
        .maybeSingle();
      if (existing) continue;
      try {
        await runDailyBriefForRetailer(r.id);
        briefedRetailers.push(r.id);
      } catch (e) {
        // continue on AI errors
      }
    }
  } catch {
    // ignore
  }

  return Response.json({
    ok: true,
    recomputed: recomputed.length,
    briefed_retailers: briefedRetailers.length,
  });
}
