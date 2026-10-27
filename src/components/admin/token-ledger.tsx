import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export function TokenLedger() {
  const fn = useServerFn(listTokenLedger);
  const [days, setDays] = useState("90");
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["token-ledger", days],
    queryFn: () => fn({ data: { days: Number(days) } }),
  });
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

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Token ledger</h3>
          <p className="text-xs text-muted-foreground">
            Every ChatGPT call TAG makes, with tokens used and estimated cost. Exact billing is on your OpenAI account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
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
                            <th className="px-4 py-2 font-medium">Task</th>
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
                                <td className="px-4 py-2 capitalize">{r.operation}</td>
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
    </section>
  );
}
