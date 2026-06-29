import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/empty-state";
import { Send } from "lucide-react";

const config: ChartConfig = {
  sent: { label: "Sent", color: "var(--chart-4)" },
  delivered: { label: "Delivered", color: "var(--chart-1)" },
  read: { label: "Read", color: "var(--success)" },
};

export function NotificationPerformanceCard({
  data,
}: {
  data: { date: string; sent: number; delivered: number; read: number }[];
}) {
  const series = data.map((d) => ({ x: d.date.slice(5), ...d }));
  const total = series.reduce((s, d) => s + d.sent, 0);
  return (
    <Card className="rounded-2xl animate-fade-in" style={{ animationDelay: "300ms", animationFillMode: "backwards" }}>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Notification performance</CardTitle>
        <p className="text-xs text-muted-foreground">Sent vs delivered vs read, last 14 days</p>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <EmptyState icon={Send} title="No notifications sent" description="Send a campaign to see delivery and read stats here." />
        ) : (
          <ChartContainer config={config} className="h-64 w-full">
            <BarChart data={series} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="x" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={28} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="sent" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="delivered" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="read" fill="var(--success)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
