// Server-only. Records every OpenAI call into ai_usage_events for the
// Admin > Integrations Token Ledger. Best-effort: logging never fails the call.
// `operation` stores a human-readable activity label (e.g. "Passport enrichment")
// so the ledger can be reported on by activity.
import { estimateChatCostUsd, OPENAI_IMAGE_PER_CALL_USD } from "./ai-usage";
import { notifyAdminCreditExhausted } from "./admin-alerts.server";
import { currentRunLabel, currentUsageContext, currentUsageUser } from "./usage-context.server";

/**
 * Inserts one ledger row, tagged with the product/store being worked on (if
 * any). If the attribution columns don't exist yet (SQL not run), retries with
 * the original columns so logging never breaks.
 */
// Names of people who triggered calls, cached so each call doesn't look them up again.
const userNames = new Map<string, string | null>();
async function userNameFor(userId: string): Promise<string | null> {
  if (userNames.has(userId)) return userNames.get(userId) ?? null;
  let name: string | null = null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: profile } = await db.from("profiles").select("full_name").eq("id", userId).maybeSingle();
    name = (profile?.full_name as string | null)?.trim() || null;
    if (!name) {
      const { data } = await db.auth.admin.getUserById(userId);
      name = data?.user?.email ?? null;
    }
  } catch {
    name = null;
  }
  userNames.set(userId, name);
  return name;
}

async function insertUsage(row: Record<string, unknown>, errorMessage?: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ctx = currentUsageContext();
  const userId = currentUsageUser() ?? null;
  const legacy = { ...row, product_id: ctx?.productId ?? null, retailer_id: ctx?.retailerId ?? null };
  const withProduct = {
    ...legacy,
    store_id: ctx?.storeId ?? null,
    product_name: ctx?.productName ?? null,
    store_name: ctx?.storeName ?? null,
    retailer_name: ctx?.retailerName ?? null,
  };
  const full = {
    ...withProduct,
    error_message: errorMessage ? errorMessage.slice(0, 400) : null,
    run_label: currentRunLabel() ?? null,
    user_id: userId,
    user_name: userId ? await userNameFor(userId) : null,
  };
  const db = supabaseAdmin as any;
  // Newest columns first; fall back to older shapes until the SQL has been run.
  for (const shape of [full, withProduct, legacy]) {
    const { error } = await db.from("ai_usage_events").insert(shape);
    if (!error) break;
  }
  void maybeBudgetAlert();
}

// ----- monthly budget warning -------------------------------------------
// Checked at most every 5 minutes per worker; the marker rows in
// notifyBudgetThreshold make sure each level is only ever emailed once a month.
let lastBudgetCheck = 0;
async function maybeBudgetAlert() {
  if (Date.now() - lastBudgetCheck < 5 * 60_000) return;
  lastBudgetCheck = Date.now();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: settings } = await db
      .from("ledger_settings")
      .select("monthly_budget_usd, alert_at_percent")
      .eq("id", true)
      .maybeSingle();
    const budget = Number(settings?.monthly_budget_usd ?? 0);
    if (!budget) return;
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const { data: rows } = await db
      .from("ai_usage_events")
      .select("cost_usd")
      .gte("created_at", monthStart)
      .neq("provider", "alert")
      .limit(50000);
    const spend = (rows ?? []).reduce((a: number, r: any) => a + Number(r.cost_usd ?? 0), 0);
    const pct = (spend / budget) * 100;
    const { notifyBudgetThreshold } = await import("./admin-alerts.server");
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const alertAt = Number(settings?.alert_at_percent ?? 80);
    if (pct >= 100) await notifyBudgetThreshold(monthKey, 100, spend, budget);
    else if (pct >= alertAt) await notifyBudgetThreshold(monthKey, alertAt, spend, budget);
  } catch {
    /* budget warnings are best-effort */
  }
}

/** The provider's own explanation of a failed call, trimmed. */
function failureText(status: number, json: any, raw: string): string | null {
  if (status < 400) return null;
  const msg = json?.error?.message ?? (typeof json?.error === "string" ? json.error : null) ?? json?.message ?? null;
  const text = String(msg ?? raw ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 400) : null;
}

function operationFromUrl(url: string): string {
  if (url.includes("/images/")) return "Image generation";
  if (url.includes("/chat/completions")) return "Chat";
  if (url.includes("/responses")) return "Chat";
  if (url.includes("/embeddings")) return "Embeddings";
  return "other";
}

async function record(url: string, activity: string | undefined, res: Response, body: unknown) {
  try {
    const kind = operationFromUrl(url);
    if (kind === "other") return; // e.g. listing models costs nothing
    let json: any = null;
    let raw = "";
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) json = await res.clone().json().catch(() => null);
    else if (!res.ok) raw = await res.clone().text().catch(() => "");
    const reqModel = (body as any)?.model ?? null;
    const model: string | null = json?.model ?? reqModel;
    const u = json?.usage ?? {};
    const input = u.prompt_tokens ?? u.input_tokens ?? null;
    const output = u.completion_tokens ?? u.output_tokens ?? null;
    const total = u.total_tokens ?? (input != null || output != null ? (input ?? 0) + (output ?? 0) : null);
    const cost =
      kind === "Image generation"
        ? res.ok
          ? OPENAI_IMAGE_PER_CALL_USD * Number((body as any)?.n ?? 1)
          : 0
        : estimateChatCostUsd(model, input, output);
    await insertUsage(
      {
        provider: "openai",
        operation: activity ?? kind,
        model,
        input_tokens: input,
        output_tokens: output,
        total_tokens: total,
        cost_usd: cost,
        status: res.status,
      },
      failureText(res.status, json, raw),
    );
    if (res.status === 402 || res.status === 429) {
      const text = JSON.stringify(json ?? {});
      if (res.status === 402 || /insufficient_quota|credit|billing|quota/i.test(text)) {
        await notifyAdminCreditExhausted("openai");
      }
    }
  } catch (e) {
    console.warn("[ai-usage] could not record usage", e);
  }
}

/** Drop-in replacement for fetch() on OpenAI endpoints that logs token usage.
 *  The activity label can be passed as the 3rd arg or as `init.activity`. */
export async function openAiFetch(
  input: RequestInfo | URL,
  init?: RequestInit & { activity?: string },
  activity?: string,
): Promise<Response> {
  let reqInit: RequestInit | undefined = init;
  if (init && "activity" in init) {
    const { activity: a, ...rest } = init;
    activity = activity ?? a;
    reqInit = rest;
  }
  const res = await fetch(input, reqInit);
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  let body: unknown = null;
  if (typeof reqInit?.body === "string") {
    try {
      body = JSON.parse(reqInit.body);
    } catch {
      body = null;
    }
  }
  await record(url, activity, res, body);
  return res;
}

/** Approximate Serper price per search (pay-as-you-go tier). */
export const SERPER_PER_SEARCH_USD = 0.001;

/** Log a paid non-OpenAI service call (e.g. Serper search) in the ledger. Best-effort. */
export async function logServiceCall(
  provider: string,
  activity: string,
  status: number,
  costUsd: number,
  errorText?: string | null,
) {
  try {
    await insertUsage(
      {
        provider,
        operation: activity,
        model: provider,
        input_tokens: null,
        output_tokens: null,
        total_tokens: null,
        cost_usd: status < 400 ? costUsd : 0,
        status,
      },
      status >= 400 ? failureText(status, null, errorText ?? "") : null,
    );
  } catch (e) {
    console.warn("[ai-usage] could not record service call", e);
  }
}
