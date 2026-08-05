import { createFileRoute } from "@tanstack/react-router";

// Evening digest for retail managers. Trigger via pg_cron, e.g. 18:00 daily.
export const Route = createFileRoute("/api/public/hooks/daily-summary")({
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
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendDailySummaries } = await import("@/lib/daily-summary.server");
        const result = await sendDailySummaries(supabaseAdmin);
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
