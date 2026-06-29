import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/empty-state";
import { QrCode } from "lucide-react";

const config: ChartConfig = {
  count: { label: "Scans", color: "var(--primary)" },
};

export function ScanTrendsCard({
  daily,
  weekly,
  monthly,
}: {
  daily: { date: string; count: number }[];
  weekly: { weekStart: string; count: number }[];
  monthly: { month: string; count: number }[];
}) {
  const [tab, setTab] = useState<"daily" | "weekly" | "monthly">("daily");
  const data =
    tab === "daily"
      ? daily.map((d) => ({ x: d.date.slice(5), count: d.count }))
      : tab === "weekly"
        ? weekly.map((d) => ({ x: d.weekStart.slice(5), count: d.count }))
        : monthly.map((d) => ({ x: d.month, count: d.count }));

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <Card className="rounded-2xl animate-fade-in" style={{ animationDelay: "120ms", animationFillMode: "backwards" }}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div>
          <CardTitle className="text-base font-semibold">Scan trends</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {total.toLocaleString()} scans in the current window
          </p>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="h-8">
            <TabsTrigger value="daily" className="text-xs">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState
            icon={QrCode}
            title="No scans yet"
            description="Once customers scan QR tags in-store, activity will show up here."
          />
        ) : (
          <ChartContainer config={config} className="h-64 w-full">
            <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="scan-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="x" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="url(#scan-fill)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
