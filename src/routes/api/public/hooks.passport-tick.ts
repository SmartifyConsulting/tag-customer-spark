import { createFileRoute } from "@tanstack/react-router";

// Drains the passport enrichment queue. Call from pg_cron or an external
// scheduler. Not authenticated (public prefix) — protect with a shared
// secret when set.
export const Route = createFileRoute("/api/public/hooks/passport-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET;
        if (cronSecret) {
          const sent = request.headers.get("x-cron-secret");
          if (sent !== cronSecret) {
            return new Response("Unauthorized", { status: 401 });
          }
        }
        const limit = Math.min(
          Number(new URL(request.url).searchParams.get("limit") ?? "20"),
          50,
        );
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { enrichProductPassport } = await import("@/lib/passport.server");

        const { data: jobs } = await supabaseAdmin
          .from("passport_enrichment_queue")
          .select("product_id")
          .order("enqueued_at", { ascending: true })
          .limit(limit);

        const list = jobs ?? [];
        const processed: Array<{ id: string; ok: boolean; error?: string }> = [];
        const BATCH = 5;
        for (let i = 0; i < list.length; i += BATCH) {
          const chunk = list.slice(i, i + BATCH);
          const results = await Promise.all(
            chunk.map((job) => enrichProductPassport(supabaseAdmin, job.product_id)),
          );
          chunk.forEach((job, idx) => {
            const r = results[idx];
            processed.push({ id: job.product_id, ok: r.ok, error: r.ok ? undefined : r.error });
          });
        }
        return Response.json({ processed: processed.length, results: processed });

      },
    },
  },
});
