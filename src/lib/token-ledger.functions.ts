import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function assertSuperAdmin(supabase: any, userId: string) {
  // user_roles queried directly: has_role() is not callable by `authenticated`.
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .limit(1)
    .maybeSingle();
  if (!data) throw new Error("This area is restricted to the system administrator.");
}

export const listTokenLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ from: isoDate, to: isoDate }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSuperAdmin(supabase, userId);
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

    // The extra columns exist once the ledger SQL has been run; before that,
    // fall back to older shapes so the ledger still loads.
    const withProduct = `${base}, product_id, product_name, store_id, store_name, retailer_name`;
    const withInsights = `${withProduct}, error_message, run_label, user_id, user_name`;
    let res = await query(withInsights);
    if (res.error) res = await query(withProduct);
    if (res.error) res = await query(base);
    if (res.error) throw new Error(res.error.message);
    return { rows: (res.data ?? []) as any[] };
  });

// ---------- exchange rate ----------

export const getZarRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { getUsdZarRate } = await import("./fx.server");
    return getUsdZarRate();
  });

// ---------- monthly budget ----------

export type LedgerSettings = {
  /** The settings table exists (SQL has been run). */
  ready: boolean;
  monthlyBudgetUsd: number | null;
  alertAtPercent: number;
};

export const getLedgerSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LedgerSettings> => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("ledger_settings")
      .select("monthly_budget_usd, alert_at_percent")
      .eq("id", true)
      .maybeSingle();
    if (error) return { ready: false, monthlyBudgetUsd: null, alertAtPercent: 80 };
    return {
      ready: true,
      monthlyBudgetUsd: data?.monthly_budget_usd != null ? Number(data.monthly_budget_usd) : null,
      alertAtPercent: Number(data?.alert_at_percent ?? 80),
    };
  });

export const saveLedgerSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        monthlyBudgetUsd: z.number().min(0).max(1_000_000).nullable(),
        alertAtPercent: z.number().int().min(1).max(100),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("ledger_settings").upsert(
      {
        id: true,
        monthly_budget_usd: data.monthlyBudgetUsd && data.monthlyBudgetUsd > 0 ? data.monthlyBudgetUsd : null,
        alert_at_percent: data.alertAtPercent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) {
      throw new Error(
        /does not exist|schema cache|42P01|PGRST205/i.test(error.message)
          ? "Budgets aren't set up yet — run the token_ledger_insights SQL in the Lovable SQL editor, then try again."
          : error.message,
      );
    }
    return { ok: true };
  });
