// Server-only. Records every OpenAI call into ai_usage_events for the
// Admin > Integrations Token Ledger. Best-effort: logging never fails the call.
// `operation` stores a human-readable activity label (e.g. "Passport enrichment")
// so the ledger can be reported on by activity.
import { estimateChatCostUsd, OPENAI_IMAGE_PER_CALL_USD } from "./ai-usage";
import { notifyAdminCreditExhausted } from "./admin-alerts.server";

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
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) json = await res.clone().json().catch(() => null);
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_usage_events").insert({
      provider: "openai",
      operation: activity ?? kind,
      model,
      input_tokens: input,
      output_tokens: output,
      total_tokens: total,
      cost_usd: cost,
      status: res.status,
    });
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
export async function logServiceCall(provider: string, activity: string, status: number, costUsd: number) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_usage_events").insert({
      provider,
      operation: activity,
      model: provider,
      input_tokens: null,
      output_tokens: null,
      total_tokens: null,
      cost_usd: status < 400 ? costUsd : 0,
      status,
    });
  } catch (e) {
    console.warn("[ai-usage] could not record service call", e);
  }
}
