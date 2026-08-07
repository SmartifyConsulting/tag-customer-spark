import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { productOwnershipSummary } from "@/lib/ownership.functions";

/**
 * Ownership block on the retailer product page — what happened to this
 * product after it left the shelf.
 */
export function ProductOwnershipCard({ productId }: { productId: string }) {
  const summaryFn = useServerFn(productOwnershipSummary);
  const { data, isLoading } = useQuery({
    queryKey: ["ownership", "product-summary", productId],
    queryFn: () => summaryFn({ data: { productId } }),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="h-28 rounded-xl" />;
  const s = data as any;
  if (!s) return null;

  const cells = [
    { label: "Units purchased", value: String(s.unitsPurchased) },
    { label: "Units owned", value: String(s.unitsOwned) },
    {
      label: "Avg warranty left",
      value: s.averageWarrantyDaysRemaining ? `${s.averageWarrantyDaysRemaining} days` : "—",
    },
    { label: "Receipts available", value: String(s.receiptsAvailable) },
    { label: "Current value", value: formatMoney(s.currentValueCents ?? 0) },
  ];

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5">
        <p className="text-sm font-semibold">Ownership</p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {cells.map((c) => (
            <div key={c.label}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className="mt-0.5 text-lg font-semibold">{c.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
