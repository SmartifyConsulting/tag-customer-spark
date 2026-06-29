// Server-only AI jobs (daily brief, weekly report). Imported dynamically.
import { z } from "zod";
import { generateObject } from "ai";
import { getGatewayFromEnv } from "./ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const opportunityListSchema = z.object({
  opportunities: z.array(
    z.object({
      title: z.string(),
      body: z.string(),
      score: z.number().min(0).max(100),
      action_type: z.string().optional(),
      projected_value_cents: z.number().optional(),
      entity_type: z.string().optional(),
      entity_id: z.string().uuid().optional(),
    }),
  ).max(8),
});

const execSummarySchema = z.object({
  headline: z.string(),
  summary: z.string(),
  highlights: z.array(z.string()).max(5),
  watchouts: z.array(z.string()).max(3),
});

const weeklyReportSchema = z.object({
  title: z.string(),
  executive_overview: z.string(),
  wins: z.array(z.string()),
  problems: z.array(z.string()),
  next_week_actions: z.array(z.string()),
  metrics_commentary: z.string(),
});

async function gatherRetailerSnapshot(retailerId: string) {
  const [products, scans, recoveries, campaigns, customers, lowStock] = await Promise.all([
    supabaseAdmin.from("products").select("id,name,price_cents,stock_qty,low_stock_threshold,intent_score,intent_score_trend,sale_price_cents").eq("retailer_id", retailerId),
    supabaseAdmin.from("qr_scans").select("product_id, scanned_at").eq("retailer_id", retailerId).gte("scanned_at", new Date(Date.now() - 7*864e5).toISOString()),
    supabaseAdmin.from("sales_recoveries").select("amount_cents, product_id, recovered_at").eq("retailer_id", retailerId).gte("recovered_at", new Date(Date.now() - 7*864e5).toISOString()),
    supabaseAdmin.from("notification_campaigns").select("id,title,type,status,audience_size,sent_at").eq("retailer_id", retailerId).gte("created_at", new Date(Date.now() - 14*864e5).toISOString()),
    supabaseAdmin.from("customers").select("id, opted_in_at").eq("retailer_id", retailerId),
    supabaseAdmin.from("customer_interests").select("product_id, status").eq("retailer_id", retailerId).eq("status", "active"),
  ]);

  const scanByProd = new Map<string, number>();
  (scans.data ?? []).forEach((s: any) => scanByProd.set(s.product_id, (scanByProd.get(s.product_id) ?? 0) + 1));
  const waitingByProd = new Map<string, number>();
  (lowStock.data ?? []).forEach((s: any) => waitingByProd.set(s.product_id, (waitingByProd.get(s.product_id) ?? 0) + 1));

  return {
    productCount: products.data?.length ?? 0,
    customerCount: customers.data?.length ?? 0,
    weekRecoveredCents: (recoveries.data ?? []).reduce((s: number, r: any) => s + r.amount_cents, 0),
    weekScans: scans.data?.length ?? 0,
    products: (products.data ?? []).map((p: any) => ({
      ...p,
      scans_7d: scanByProd.get(p.id) ?? 0,
      waiting: waitingByProd.get(p.id) ?? 0,
    })),
    campaigns: campaigns.data ?? [],
  };
}

export async function runDailyBriefForRetailer(retailerId: string) {
  const snap = await gatherRetailerSnapshot(retailerId);
  const gateway = getGatewayFromEnv();
  const model = gateway("google/gemini-3-flash-preview");

  const prompt = `You are the AI retail intelligence layer for a furniture/apparel retailer.
Today's snapshot:
- Products: ${snap.productCount}
- Customers opted-in: ${snap.customerCount}
- Revenue recovered last 7 days: R${(snap.weekRecoveredCents/100).toFixed(0)}
- Scans last 7 days: ${snap.weekScans}

Top products by scans+waiting (last 7d):
${snap.products
  .sort((a: any, b: any) => (b.scans_7d + b.waiting*2) - (a.scans_7d + a.waiting*2))
  .slice(0, 12)
  .map((p: any) => `- ${p.name}: ${p.scans_7d} scans, ${p.waiting} waiting, price R${(p.price_cents/100).toFixed(0)}, stock ${p.stock_qty}, intent ${Number(p.intent_score).toFixed(0)} ${p.intent_score_trend}`)
  .join("\n")}

Generate up to 6 short, action-oriented OPPORTUNITIES the retailer can act on today. Examples:
- "42 customers are waiting for discounts on these 6 products."
- "This sofa has attracted 137 scans but no promotions."
- "You could recover ~R26,000 by discounting Product A by 10%."

Each opportunity has body of 1 sentence + score (0-100, higher = more valuable) + projected_value_cents when reasonable.`;

  const { object: oppOut } = await generateObject({
    model,
    system: "You write decisive, numeric retail opportunities. No fluff.",
    prompt,
    schema: opportunityListSchema as any,
  });

  await supabaseAdmin.from("ai_insights")
    .update({ status: "expired" })
    .eq("retailer_id", retailerId)
    .eq("kind", "opportunity")
    .eq("status", "active");

  if ((oppOut as any).opportunities?.length) {
    await supabaseAdmin.from("ai_insights").insert(
      (oppOut as any).opportunities.map((o: any) => ({
        retailer_id: retailerId,
        kind: "opportunity" as const,
        title: o.title,
        body: o.body,
        payload: o,
        related_entity_type: o.entity_type ?? null,
        related_entity_id: o.entity_id ?? null,
        score: o.score,
        expires_at: new Date(Date.now() + 24*864e5).toISOString(),
      })),
    );
  }

  const { object: execOut } = await generateObject({
    model,
    system: "You are an executive-level retail advisor. 2-3 sentence summary, then bullet highlights and watchouts.",
    prompt: `Same snapshot as above. Write today's executive briefing for the retailer's leadership.`,
    schema: execSummarySchema as any,
  });

  await supabaseAdmin.from("ai_insights")
    .update({ status: "expired" })
    .eq("retailer_id", retailerId)
    .eq("kind", "executive_summary")
    .eq("status", "active");

  await supabaseAdmin.from("ai_insights").insert({
    retailer_id: retailerId,
    kind: "executive_summary",
    title: (execOut as any).headline,
    body: (execOut as any).summary,
    payload: execOut as any,
    expires_at: new Date(Date.now() + 24*864e5).toISOString(),
  });

  return {
    opportunities: (oppOut as any).opportunities?.length ?? 0,
    executiveSummary: (execOut as any).headline,
  };
}

export async function runWeeklyReportForRetailer(retailerId: string) {
  const snap = await gatherRetailerSnapshot(retailerId);
  const gateway = getGatewayFromEnv();
  const model = gateway("google/gemini-2.5-pro");

  const prompt = `Compose this week's retailer performance report.
Snapshot:
- Recovered revenue (7d): R${(snap.weekRecoveredCents/100).toFixed(0)}
- Scans (7d): ${snap.weekScans}
- Products: ${snap.productCount}; Customers: ${snap.customerCount}
- Campaigns ran (14d): ${snap.campaigns.length} -> ${snap.campaigns.map((c: any) => `${c.title} [${c.type}/${c.status}, ${c.audience_size}]`).join("; ")}
- Top 10 products by intent: ${snap.products.sort((a:any,b:any)=> b.intent_score-a.intent_score).slice(0,10).map((p:any)=>`${p.name} ${Number(p.intent_score).toFixed(0)}`).join("; ")}

Write a clear weekly report with: title, executive_overview (3-5 sentences), wins, problems, next_week_actions, metrics_commentary.`;

  const { object } = await generateObject({
    model,
    system: "You are a senior retail consultant. Be specific, numeric, and pragmatic.",
    prompt,
    schema: weeklyReportSchema as any,
  });

  await supabaseAdmin.from("ai_insights").insert({
    retailer_id: retailerId,
    kind: "weekly_report",
    title: (object as any).title,
    body: (object as any).executive_overview,
    payload: object as any,
  });
  return { ok: true };
}
