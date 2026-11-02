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
    const base = "id, created_at, provider, operation, model, input_tokens, output_tokens, total_tokens, cost_usd, status";
    const query = (cols: string) =>
      (supabase as any)
        .from("ai_usage_events")
        .select(cols)
        .gte("created_at", since)
        .lt("created_at", until)
        .neq("provider", "alert")
        .order("created_at", { ascending: false })
        .limit(5000);

    // Product / store attribution columns exist once the catalogue SQL has been
    // run; before that, fall back to the original columns so the ledger still loads.
    let res = await query(`${base}, product_id, product_name, store_id, store_name, retailer_name`);
    if (res.error) res = await query(base);
    if (res.error) throw new Error(res.error.message);
    return { rows: (res.data ?? []) as any[] };
  });
