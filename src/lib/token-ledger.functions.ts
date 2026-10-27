import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const listTokenLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ from: isoDate, to: isoDate }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isSuper } = await supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" });
    if (!isSuper) throw new Error("This area is restricted to the system administrator.");
    const since = new Date(`${data.from}T00:00:00Z`).toISOString();
    const until = new Date(new Date(`${data.to}T00:00:00Z`).getTime() + 86_400_000).toISOString();
    const { data: rows, error } = await supabase
      .from("ai_usage_events")
      .select("id, created_at, provider, operation, model, input_tokens, output_tokens, total_tokens, cost_usd, status")
      .gte("created_at", since)
      .lt("created_at", until)
      .neq("provider", "alert")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
