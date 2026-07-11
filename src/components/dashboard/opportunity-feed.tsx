import type { ReactElement } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  X,
  RefreshCw,
  Lock,
  ArrowLeftRight,
  Tag as TagIcon,
  PackagePlus,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Package,
} from "lucide-react";
import { listOpportunityFeed, getExecutiveSummary, dismissInsight, generateNowDailyBrief } from "@/lib/ai.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTier } from "@/hooks/use-tier";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatZAR(cents?: number | null) {
  if (cents == null) return null;
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(cents / 100);
}

type ActionKey = "transfer" | "markdown" | "restock" | "promote";

function actionMeta(action?: string, kind?: string): { key: ActionKey; icon: ReactElement; label: string; verb: string; className: string } {
  const raw = (action ?? "").toLowerCase();
  const key: ActionKey =
    raw === "transfer" || raw === "markdown" || raw === "restock" || raw === "promote"
      ? (raw as ActionKey)
      : kind === "merchandising"
      ? "markdown"
      : "promote";
  const map: Record<ActionKey, { icon: ReactElement; label: string; verb: string; className: string }> = {
    transfer: {
      icon: <ArrowLeftRight className="h-3.5 w-3.5" />,
      label: "Transfer",
      verb: "Create",
      className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    },
    markdown: {
      icon: <TagIcon className="h-3.5 w-3.5" />,
      label: "Markdown",
      verb: "Apply",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    },
    restock: {
      icon: <PackagePlus className="h-3.5 w-3.5" />,
      label: "Restock",
      verb: "Order",
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    },
    promote: {
      icon: <Sparkles className="h-3.5 w-3.5" />,
      label: "Promote",
      verb: "Promote",
      className: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
    },
  };
  return { key, ...map[key] };
}

function signalMeta(signal?: string, body?: string): { icon: ReactElement; label: string } {
  const raw = (signal ?? "").toLowerCase();
  if (raw.includes("high") || raw.includes("demand"))
    return { icon: <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />, label: "High demand" };
  if (raw.includes("slow"))
    return { icon: <TrendingDown className="h-3.5 w-3.5 text-amber-600" />, label: "Slow sales" };
  if (raw.includes("low") || raw.includes("left"))
    return { icon: <AlertTriangle className="h-3.5 w-3.5 text-red-600" />, label: signal ?? "Low stock" };
  if (raw.includes("stock") || raw.includes("delta"))
    return { icon: <Package className="h-3.5 w-3.5 text-blue-600" />, label: signal ?? "Stock signal" };
  const fallback = (body ?? "").split(/[.\n]/)[0]?.slice(0, 48) ?? "Signal";
  return { icon: <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />, label: fallback || "Signal" };
}

function confidenceMeta(score?: number | null) {
  const n = score == null ? null : Math.round(Number(score));
  if (n == null) return { dot: "bg-muted-foreground/40", tone: "text-muted-foreground", label: "—" };
  if (n >= 90) return { dot: "bg-emerald-500", tone: "text-emerald-700 dark:text-emerald-400", label: `${n}%` };
  if (n >= 70) return { dot: "bg-amber-500", tone: "text-amber-700 dark:text-amber-400", label: `${n}%` };
  return { dot: "bg-red-500", tone: "text-red-700 dark:text-red-400", label: `${n}%` };
}

function productEmoji(category?: string) {
  const c = (category ?? "").toLowerCase();
  if (c.includes("denim") || c.includes("jean")) return "👖";
  if (c.includes("shoe") || c.includes("boot") || c.includes("foot")) return "👢";
  if (c.includes("apparel") || c.includes("shirt") || c.includes("top") || c.includes("cloth")) return "👕";
  return "📦";
}

export function OpportunityFeedCard() {
  const { hasFeature, tier } = useTier();
  if (!hasFeature("opportunityFeed")) {
    return (
      <Card className="overflow-hidden border-dashed">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              AI Opportunity Feed
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Lock className="h-3 w-3" /> Tag Pro
              </span>
            </CardTitle>
            <CardDescription>
              Daily revenue-generating actions, surfaced automatically. Upgrade to Tag Pro to unlock.
            </CardDescription>
          </div>
          <Button asChild size="sm">
            <Link to="/upgrade" search={{ feature: "opportunityFeed" }}>
              Upgrade
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            You're on <span className="font-medium capitalize">Tag {tier}</span>. The AI Opportunity Feed is a Tag Pro feature.
          </div>
        </CardContent>
      </Card>
    );
  }

  const qc = useQueryClient();
  const feed = useQuery({
    queryKey: ["ai", "opportunity-feed"],
    queryFn: () => listOpportunityFeed(),
    refetchOnWindowFocus: false,
  });
  const exec = useQuery({
    queryKey: ["ai", "executive-summary"],
    queryFn: () => getExecutiveSummary(),
    refetchOnWindowFocus: false,
  });

  const generate = useMutation({
    mutationFn: () => generateNowDailyBrief({ data: undefined }),
    onSuccess: () => {
      toast.success("AI brief refreshed");
      qc.invalidateQueries({ queryKey: ["ai"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not generate brief"),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => dismissInsight({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai", "opportunity-feed"] }),
  });

  const loading = feed.isLoading || exec.isLoading;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Opportunity Feed
          </CardTitle>
          <CardDescription>Today's revenue-generating actions, surfaced automatically.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", generate.isPending && "animate-spin")} />
          {generate.isPending ? "Generating..." : "Refresh brief"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {exec.data && !loading && (
          <div className="rounded-xl border bg-primary/[0.04] p-4">
            <div className="text-xs uppercase tracking-wide text-primary font-semibold mb-1">Executive briefing</div>
            <div className="text-sm font-semibold">{exec.data.title}</div>
            <p className="text-sm text-muted-foreground mt-1">{exec.data.body}</p>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !feed.data?.length ? (
          <div className="text-sm text-muted-foreground rounded-lg border border-dashed p-6 text-center">
            No opportunities yet. Click <span className="font-medium">Refresh brief</span> to generate today's recommendations.
          </div>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-[11px] uppercase tracking-wide">Product</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">AI Action</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide hidden md:table-cell">Store Flow</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide hidden md:table-cell">Signal</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">Revenue</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Confidence</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feed.data.map((op: any) => {
                  const p = op.payload ?? {};
                  const action = actionMeta(p.action, op.kind);
                  const sig = signalMeta(p.signal, op.body);
                  const conf = confidenceMeta(op.score);
                  const revenue = formatZAR(p.projected_value_cents);
                  const productName = p.product_name ?? op.title;
                  const emoji = productEmoji(p.category);
                  const flow =
                    p.from_store && p.to_store
                      ? `${p.from_store} → ${p.to_store}`
                      : p.from_store || p.to_store || p.store || "—";

                  return (
                    <TableRow key={op.id} className="group">
                      <TableCell className="font-medium">
                        <span className="mr-1.5">{emoji}</span>
                        <span className="align-middle">{productName}</span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
                            action.className,
                          )}
                        >
                          {action.icon}
                          {action.label}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground whitespace-nowrap">
                        {flow}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-xs text-foreground/80">
                          {sig.icon}
                          {sig.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        {revenue ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", conf.tone)}>
                          <span className={cn("h-2 w-2 rounded-full", conf.dot)} />
                          {conf.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          {op.related_entity_type === "product" && op.related_entity_id ? (
                            <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
                              <Link to="/inventory/$productId" params={{ productId: op.related_entity_id }}>
                                View
                              </Link>
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled>
                              View
                            </Button>
                          )}
                          <Button size="sm" className="h-7 px-2 text-xs">
                            {action.verb}
                          </Button>
                          <button
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition ml-1"
                            onClick={() => dismiss.mutate(op.id)}
                            aria-label="Dismiss"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
