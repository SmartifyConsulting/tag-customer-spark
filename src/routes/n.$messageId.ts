import { createFileRoute, redirect } from "@tanstack/react-router";

// Click-tracking redirect: GET /n/$messageId -> flips clicked_at then redirects to cta_url.
export const Route = createFileRoute("/n/$messageId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("notification_history")
          .select("id, payload, campaign_id, status")
          .eq("id", params.messageId)
          .maybeSingle();
        const target =
          (row?.payload as any)?.cta_url ??
          new URL(request.url).origin + "/";
        if (row && row.status !== "redeemed") {
          await supabaseAdmin
            .from("notification_history")
            .update({ status: "clicked", clicked_at: new Date().toISOString() })
            .eq("id", row.id);
        }
        throw redirect({ href: target });
      },
    },
  },
});
