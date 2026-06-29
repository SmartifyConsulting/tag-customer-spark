import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/empty-state";
import { Sparkles } from "lucide-react";

const config: ChartConfig = {
  interestCount: { label: "Interest", color: "var(--primary)" },
};

export function TopProductsCard({
  products,
}: {
  products: { id: string; name: string; interestCount: number; stockQty: number }[];
}) {
  const data = products.map((p) => ({
    name: p.name.length > 18 ? p.name.slice(0, 17) + "…" : p.name,
    interestCount: p.interestCount,
  }));
  return (
    <Card className="rounded-2xl animate-fade-in" style={{ animationDelay: "240ms", animationFillMode: "backwards" }}>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Top products by interest</CardTitle>
        <p className="text-xs text-muted-foreground">Most-tagged products this period</p>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyState icon={Sparkles} title="No interest yet" description="Tagged products will rank here once customers start scanning." />
        ) : (
          <ChartContainer config={config} className="h-64 w-full">
            <BarChart layout="vertical" data={data} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={130} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="interestCount" fill="var(--primary)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
