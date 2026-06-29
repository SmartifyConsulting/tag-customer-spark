import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/empty-state";
import { Users } from "lucide-react";

const config: ChartConfig = {
  total: { label: "Customers", color: "var(--success)" },
};

export function CustomerGrowthCard({
  data,
}: {
  data: { date: string; total: number }[];
}) {
  const series = data.map((d) => ({ x: d.date.slice(5), total: d.total }));
  const empty = series.length === 0 || series.every((d) => d.total === 0);
  return (
    <Card className="rounded-2xl animate-fade-in" style={{ animationDelay: "180ms", animationFillMode: "backwards" }}>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Customer growth</CardTitle>
        <p className="text-xs text-muted-foreground">Subscribed customers, last 30 days</p>
      </CardHeader>
      <CardContent>
        {empty ? (
          <EmptyState icon={Users} title="No customers yet" description="Opted-in customers will start to appear here." />
        ) : (
          <ChartContainer config={config} className="h-64 w-full">
            <LineChart data={series} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="x" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line type="monotone" dataKey="total" stroke="var(--success)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
