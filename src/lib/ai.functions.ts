import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function resolveRetailerId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_roles").select("retailer_id")
    .eq("user_id", userId).not("retailer_id", "is", null)
    .limit(1).maybeSingle();
  return data?.retailer_id ?? null;
}

async function callAI<T>(opts: {
  model?: string;
  system?: string;
  prompt: string;
  schema: z.ZodType<T>;
}): Promise<T> {
  const { generateObject } = await import("ai");
  const { getGatewayFromEnv } = await import("./ai-gateway.server");
  const gateway = getGatewayFromEnv();
  const model = gateway(opts.model ?? "google/gemini-3-flash-preview");
  try {
    const { object } = await generateObject({
      model,
      system: opts.system,
      prompt: opts.prompt,
      schema: opts.schema as any,
    });
    return object as T;
  } catch (e: any) {
    const msg = e?.message ?? "AI call failed";
    if (msg.includes("429")) throw new Error("Rate limit hit. Try again in a moment.");
    if (msg.includes("402")) throw new Error("AI credits exhausted. Add credits to keep going.");
    throw new Error(msg);
  }
}

// --- Campaign writer ---------------------------------------------------------
const writeInput = z.object({
  product_id: z.string().uuid().optional(),
  type: z.enum(["sale", "low_stock", "back_in_stock", "promotion", "custom"]),
  tone: z.enum(["urgent", "friendly", "premium", "playful"]).default("friendly"),
  hint: z.string().max(400).optional(),
});

const messageSchema = z.object({
  headline: z.string(),
  body: z.string(),
  cta_label: z.string(),
});

export const writeCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => writeInput.parse(d))
  .handler(async ({ data, context }) => {
    let product: any = null;
    let retailer: any = null;
    if (data.product_id) {
      const { data: p } = await context.supabase
        .from("products")
        .select("name, brand, price_cents, sale_price_cents, currency, retailer:retailers(name)")
        .eq("id", data.product_id).maybeSingle();
      product = p;
      retailer = p?.retailer;
    }
    const prompt = `Write a WhatsApp marketing message for a ${data.type.replace("_", " ")} campaign.
Tone: ${data.tone}.
${product ? `Product: ${product.name}${product.brand ? ` (${product.brand})` : ""}.` : ""}
${retailer ? `Retailer: ${retailer.name}.` : ""}
${data.hint ? `Extra direction: ${data.hint}` : ""}
Rules: headline under 60 chars. Body under 280 chars, conversational, no spammy emoji storms. CTA 2-4 words.`;
    return callAI({
      system: "You write short, high-converting WhatsApp retail messages.",
      prompt,
      schema: messageSchema,
    });
  });

// --- Rewrite -----------------------------------------------------------------
export const rewriteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      headline: z.string().default(""),
      body: z.string().default(""),
      cta_label: z.string().default(""),
      direction: z.enum(["tighten", "urgent", "friendly", "premium", "playful"]).default("tighten"),
    }).parse(d),
  )
  .handler(async ({ data }) =>
    callAI({
      system: "You rewrite WhatsApp retail messages to a target style without changing facts.",
      prompt: `Rewrite this campaign. Target: ${data.direction}.
Headline: ${data.headline}
Body: ${data.body}
CTA: ${data.cta_label}`,
      schema: messageSchema,
    }),
  );

// --- Predict response --------------------------------------------------------
export const predictCampaignResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      type: z.string(),
      audience_size: z.number(),
      headline: z.string().default(""),
      body: z.string().default(""),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // pull retailer baseline funnel from notification_history
    const { data: hist } = await context.supabase
      .from("notification_history")
      .select("status")
      .limit(500);
    const total = hist?.length ?? 0;
    const baseDelivered = total ? (hist!.filter((h: any) => ["delivered","read","clicked","redeemed"].includes(h.status)).length / total) : 0.85;
    const baseRead = total ? (hist!.filter((h: any) => ["read","clicked","redeemed"].includes(h.status)).length / total) : 0.45;
    const baseClick = total ? (hist!.filter((h: any) => ["clicked","redeemed"].includes(h.status)).length / total) : 0.12;
    const baseRedeem = total ? (hist!.filter((h: any) => h.status === "redeemed").length / total) : 0.03;

    return callAI({
      system: "You are a retail marketing analyst. Estimate WhatsApp campaign response rates and produce a single short rationale.",
      prompt: `Campaign type: ${data.type}. Audience: ${data.audience_size}.
Retailer baseline: deliver ${(baseDelivered*100).toFixed(0)}%, read ${(baseRead*100).toFixed(0)}%, click ${(baseClick*100).toFixed(0)}%, redeem ${(baseRedeem*100).toFixed(0)}%.
Message headline: "${data.headline}"
Message body: "${data.body}"
Adjust the baseline up or down based on type (e.g. sales beat baseline by 15-30%, low_stock by 20-40%).`,
      schema: z.object({
        predicted_delivered_pct: z.number(),
        predicted_read_pct: z.number(),
        predicted_click_pct: z.number(),
        predicted_redeem_pct: z.number(),
        rationale: z.string(),
      }),
    });
  });

// --- Recommend send time -----------------------------------------------------
export const recommendSendTime = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data: _data }) => {
    const { data: scans } = await context.supabase
      .from("qr_scans").select("scanned_at").limit(500);
    const buckets: Record<string, number> = {};
    (scans ?? []).forEach((s: any) => {
      const d = new Date(s.scanned_at);
      const key = `${d.getDay()}-${d.getHours()}`;
      buckets[key] = (buckets[key] ?? 0) + 1;
    });
    const top = Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return callAI({
      system: "You recommend the best time to send a WhatsApp campaign based on customer activity.",
      prompt: `Customer activity heatmap (weekday-hour : scans): ${top.map(([k,v]) => `${k}=${v}`).join(", ") || "no data"}.
Recommend one specific send time within the next 7 days and a 1-sentence reason.`,
      schema: z.object({
        recommended_iso: z.string().describe("ISO datetime"),
        weekday: z.string(),
        hour_local: z.number().int().min(0).max(23),
        reason: z.string(),
      }),
    });
  });

// --- Summarise conversation --------------------------------------------------
export const summariseConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: msgs } = await context.supabase
      .from("conversation_messages")
      .select("direction, body, is_internal, sent_at")
      .eq("conversation_id", data.conversation_id)
      .order("sent_at", { ascending: true })
      .limit(80);
    const transcript = (msgs ?? [])
      .filter((m: any) => !m.is_internal && m.body)
      .map((m: any) => `${m.direction === "outbound" ? "STAFF" : "CUSTOMER"}: ${m.body}`)
      .join("\n");
    if (!transcript) return { summary: "No messages to summarise yet.", suggested_reply: "", sentiment: "neutral" as const };
    const result = await callAI({
      system: "You summarise retail WhatsApp conversations in two short lines and propose a friendly reply.",
      prompt: `Transcript:\n${transcript}\n\nReturn: a 2-line summary, a suggested staff reply (<=240 chars), sentiment (positive/neutral/negative).`,
      schema: z.object({
        summary: z.string(),
        suggested_reply: z.string(),
        sentiment: z.enum(["positive", "neutral", "negative"]),
      }),
    });
    // persist
    const { data: convo } = await context.supabase.from("conversations").select("retailer_id").eq("id", data.conversation_id).maybeSingle();
    if (convo?.retailer_id) {
      await context.supabase.from("ai_insights").insert({
        retailer_id: convo.retailer_id,
        kind: "conversation_summary",
        title: "Conversation summary",
        body: result.summary,
        payload: result as any,
        related_entity_type: "conversation",
        related_entity_id: data.conversation_id,
        created_by: context.userId,
      });
    }
    return result;
  });

// --- Insights feed reader ----------------------------------------------------
export const listOpportunityFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ai_insights")
      .select("*")
      .eq("status", "active")
      .in("kind", ["opportunity", "merchandising"])
      .order("score", { ascending: false, nullsFirst: false })
      .order("generated_at", { ascending: false })
      .limit(12);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getExecutiveSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("ai_insights")
      .select("*")
      .eq("kind", "executive_summary")
      .eq("status", "active")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  });

export const listWeeklyReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("ai_insights")
      .select("*")
      .eq("kind", "weekly_report")
      .order("generated_at", { ascending: false })
      .limit(20);
    return data ?? [];
  });

export const dismissInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("ai_insights").update({ status: "dismissed" }).eq("id", data.id);
    return { ok: true };
  });

// --- On-demand trigger so users can generate now ---------------------------
export const generateNowDailyBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const retailerId = await resolveRetailerId(context.supabase, context.userId);
    if (!retailerId) throw new Error("No retailer assigned to your account.");
    const { runDailyBriefForRetailer } = await import("./ai-jobs.server");
    return runDailyBriefForRetailer(retailerId);
  });

export const generateNowWeeklyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const retailerId = await resolveRetailerId(context.supabase, context.userId);
    if (!retailerId) throw new Error("No retailer assigned to your account.");
    const { runWeeklyReportForRetailer } = await import("./ai-jobs.server");
    return runWeeklyReportForRetailer(retailerId);
  });
