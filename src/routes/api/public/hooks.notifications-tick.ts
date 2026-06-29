import { createFileRoute } from "@tanstack/react-router";

// Simulated delivery tick. Promotes notification_history rows:
//   queued -> sent (~30s),  sent -> delivered (~60s),  delivered -> read (~3min)
// Click + redeem transitions come from the customer interaction routes.

export const Route = createFileRoute("/api/public/hooks/notifications-tick")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = Date.now();

        // queued -> sent
        await supabaseAdmin
          .from("notification_history")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("status", "queued")
          .lte("queued_at", new Date(now - 30_000).toISOString());

        // sent -> delivered (90% pass)
        const { data: sentRows } = await supabaseAdmin
          .from("notification_history")
          .select("id")
          .eq("status", "sent")
          .lte("sent_at", new Date(now - 60_000).toISOString())
          .limit(500);
        if (sentRows?.length) {
          const ids = sentRows.map((r) => r.id);
          await supabaseAdmin
            .from("notification_history")
            .update({ status: "delivered", delivered_at: new Date().toISOString() })
            .in("id", ids);
        }

        // delivered -> read (70% pass)
        const { data: delivRows } = await supabaseAdmin
          .from("notification_history")
          .select("id")
          .eq("status", "delivered")
          .lte("delivered_at", new Date(now - 180_000).toISOString())
          .limit(500);
        if (delivRows?.length) {
          // Randomly read 70%
          const toRead = delivRows.filter(() => Math.random() < 0.7).map((r) => r.id);
          if (toRead.length) {
            await supabaseAdmin
              .from("notification_history")
              .update({ status: "read", read_at: new Date().toISOString() })
              .in("id", toRead);
          }
        }

        // Mark campaigns completed when all rows past sent
        const { data: sendingCampaigns } = await supabaseAdmin
          .from("notification_campaigns")
          .select("id")
          .eq("status", "sending");
        for (const c of sendingCampaigns ?? []) {
          const { count: pending } = await supabaseAdmin
            .from("notification_history")
            .select("id", { count: "exact", head: true })
            .eq("campaign_id", c.id)
            .in("status", ["queued"]);
          if ((pending ?? 0) === 0) {
            await supabaseAdmin
              .from("notification_campaigns")
              .update({ status: "completed" })
              .eq("id", c.id);
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
