import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { listTokenLedger } from "@/lib/token-ledger.functions";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  created_at: string;
  operation: string;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cost_usd: number | string | null;
  status: number | null;
};

const usd = (n: number) => `USD ${n.toFixed(n < 1 ? 4 : 2)}`;
const num = (n: number) => n.toLocaleString();
const monthKey = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

function totals(rows: Row[]) {
  return rows.reduce(
    (a, r) => ({
      tokens: a.tokens + (r.total_tokens ?? 0),
      input: a.input + (r.input_tokens ?? 0),
      output: a.output + (r.output_tokens ?? 0),
      cost: a.cost + Number(r.cost_usd ?? 0),
      failed: a.failed + (r.status && r.status >= 400 ? 1 : 0),
    }),
    { tokens: 0, input: 0, output: 0, cost: 0, failed: 0 },
  );
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export function TokenLedger() {
  const fn = useServerFn(listTokenLedger);
  const [from, setFrom] = useState(() => ymd(new Date(Date.now() - 30 * 86_400_000)));
  const [to, setTo] = useState(() => ymd(new Date()));
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["token-ledger", from, to],
    queryFn: () => fn({ data: { from, to } }),
    enabled: !!from && !!to && from <= to,
  });
  const [tab, setTab] = useState<"ledger" | "reports">("ledger");
  const rows = (data?.rows ?? []) as Row[];
  const t = useMemo(() => totals(rows), [rows]);
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>();
    for (const r of rows) {
      const k = monthKey(r.created_at);
      m.set(k, [...(m.get(k) ?? []), r]);
    }
    return Array.from(m.entries());
  }, [rows]);
  const preset = (days: number) => {
    setFrom(ymd(new Date(Date.now() - days * 86_400_000)));
    setTo(ymd(new Date()));
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Token ledger</h3>
          <p className="text-xs text-muted-foreground">
            Every paid AI and search call TAG makes, with tokens used and estimated cost. Exact billing is on each provider's account.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-border p-0.5">
            {(["ledger", "reports"] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={tab === k}
                onClick={() => setTab(k)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {k === "ledger" ? "Ledger" : "Reports"}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            From
            <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="h-8 w-[140px] text-xs" />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            To
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="h-8 w-[140px] text-xs" />
          </label>
          <Select value="" onValueChange={(v) => preset(Number(v))}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue placeholder="Quick pick" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Today</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {tab === "reports" ? (
        <TokenReport rows={rows} loading={isLoading} />
      ) : (
      <>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Calls", num(rows.length)],
          ["Tokens", num(t.tokens)],
          ["Estimated cost", usd(t.cost)],
          ["Failed calls", num(t.failed)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-border bg-card p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 font-mono text-base font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-card">
        {error ? (
          <p className="p-6 text-sm text-muted-foreground">{(error as Error).message}</p>
        ) : isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <Accordion type="multiple" defaultValue={[groups[0]?.[0] ?? ""]}>
            {groups.map(([month, list]) => {
              const g = totals(list);
              return (
                <AccordionItem key={month} value={month} className="border-border last:border-b-0">
                  <AccordionTrigger className="bg-muted/50 px-4 py-3 text-sm font-medium hover:no-underline">
                    <span className="flex flex-1 items-center justify-between pr-3">
                      <span>{month}</span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {num(g.tokens)} tokens · {usd(g.cost)} · {list.length} call{list.length === 1 ? "" : "s"}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-0 pb-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="border-y border-border text-left text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2 font-medium">When</th>
                            <th className="px-4 py-2 font-medium">Activity</th>
                            <th className="px-4 py-2 font-medium">Model</th>
                            <th className="px-4 py-2 text-right font-medium">In</th>
                            <th className="px-4 py-2 text-right font-medium">Out</th>
                            <th className="px-4 py-2 text-right font-medium">Total</th>
                            <th className="px-4 py-2 text-right font-medium">Cost</th>
                            <th className="px-4 py-2 font-medium">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {list.map((r) => {
                            const failed = !!r.status && r.status >= 400;
                            return (
                              <tr key={r.id}>
                                <td className="whitespace-nowrap px-4 py-2">
                                  {new Date(r.created_at).toLocaleString()}
                                </td>
                                <td className="px-4 py-2">{r.operation}</td>
                                <td className="px-4 py-2 font-mono">{r.model ?? "—"}</td>
                                <td className="px-4 py-2 text-right font-mono tabular-nums">{num(r.input_tokens ?? 0)}</td>
                                <td className="px-4 py-2 text-right font-mono tabular-nums">{num(r.output_tokens ?? 0)}</td>
                                <td className="px-4 py-2 text-right font-mono tabular-nums">{num(r.total_tokens ?? 0)}</td>
                                <td className="px-4 py-2 text-right font-mono tabular-nums">{usd(Number(r.cost_usd ?? 0))}</td>
                                <td className="px-4 py-2">
                                  <Badge variant={failed ? "destructive" : "outline"} className="text-[10px]">
                                    {failed ? (r.status === 429 ? "No credit" : `Error ${r.status}`) : "OK"}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
      </>
      )}
    </section>
  );
}

function TokenReport({ rows, loading }: { rows: Row[]; loading: boolean }) {
  const [activity, setActivity] = useState("all");
  const [model, setModel] = useState("all");
  const [result, setResult] = useState("all");
  const [groupBy, setGroupBy] = useState<"activity" | "model" | "day">("activity");

  const activities = useMemo(() => Array.from(new Set(rows.map((r) => r.operation))).sort(), [rows]);
  const models = useMemo(() => Array.from(new Set(rows.map((r) => r.model ?? "—"))).sort(), [rows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const failed = !!r.status && r.status >= 400;
        if (activity !== "all" && r.operation !== activity) return false;
        if (model !== "all" && (r.model ?? "—") !== model) return false;
        if (result === "ok" && failed) return false;
        if (result === "failed" && !failed) return false;
        return true;
      }),
    [rows, activity, model, result],
  );
  const t = useMemo(() => totals(filtered), [filtered]);

  const grouped = useMemo(() => {
    const keyOf = (r: Row) =>
      groupBy === "activity" ? r.operation : groupBy === "model" ? r.model ?? "—" : r.created_at.slice(0, 10);
    const m = new Map<string, Row[]>();
    for (const r of filtered) m.set(keyOf(r), [...(m.get(keyOf(r)) ?? []), r]);
    return Array.from(m.entries())
      .map(([k, list]) => ({ key: k, calls: list.length, ...totals(list) }))
      .sort((a, b) => (groupBy === "day" ? b.key.localeCompare(a.key) : b.cost - a.cost));
  }, [filtered, groupBy]);

  const picker = (label: string, value: string, set: (v: string) => void, options: [string, string][]) => (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={set}>
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {picker("Activity", activity, setActivity, [["all", "All activities"], ...activities.map((a) => [a, a] as [string, string])])}
        {picker("Model", model, setModel, [["all", "All models"], ...models.map((a) => [a, a] as [string, string])])}
        {picker("Result", result, setResult, [["all", "All results"], ["ok", "Successful"], ["failed", "Failed"]])}
        {picker("Group by", groupBy, (v) => setGroupBy(v as any), [["activity", "Activity"], ["model", "Model"], ["day", "Day"]])}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Calls", num(filtered.length)],
          ["Tokens", num(t.tokens)],
          ["Estimated cost", usd(t.cost)],
          ["Avg cost / call", usd(filtered.length ? t.cost / filtered.length : 0)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-border bg-card p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 font-mono text-base font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : grouped.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No calls match these filters.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium capitalize">{groupBy}</th>
                <th className="px-4 py-2 text-right font-medium">Calls</th>
                <th className="px-4 py-2 text-right font-medium">Tokens</th>
                <th className="px-4 py-2 text-right font-medium">Cost</th>
                <th className="px-4 py-2 text-right font-medium">Share</th>
                <th className="px-4 py-2 text-right font-medium">Failed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {grouped.map((g) => (
                <tr key={g.key}>
                  <td className="px-4 py-2">{g.key}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{num(g.calls)}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{num(g.tokens)}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{usd(g.cost)}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">
                    {t.cost > 0 ? `${((g.cost / t.cost) * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{num(g.failed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
