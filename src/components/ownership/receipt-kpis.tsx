import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { receiptKpis } from "@/lib/ownership.functions";

/** Digital receipt adoption at a glance, for the retail side. */
export function ReceiptKpiRow() {
  const fn = useServerFn(receiptKpis);
  const { data, isLoading } = useQuery({
    queryKey: ["ownership", "receipt-kpis"],
    queryFn: () => fn(),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="h-24 rounded-xl" />;
  const k = data as any;
  if (!k) return null;

  const cells = [
    { label: "Digital receipts issued", value: String(k.digitalReceiptsIssued) },
    { label: "Paper receipts avoided", value: String(k.paperReceiptsAvoided) },
    { label: "Customers using TAG", value: String(k.customersUsingTag) },
    { label: "Avg receipts / customer", value: String(k.averageReceiptsPerCustomer) },
    { label: "Digital adoption", value: `${k.digitalAdoptionRate}%` },
  ];

  return (
    <Card className="rounded-2xl">
      <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-5">
        {cells.map((c) => (
          <div key={c.label}>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className="mt-0.5 text-xl font-semibold">{c.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
