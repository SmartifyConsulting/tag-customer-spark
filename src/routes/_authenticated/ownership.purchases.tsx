import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useReceiptsEnabled } from "@/hooks/use-receipts-enabled";
import { ReceiptsDisabled } from "@/components/ownership/receipts-disabled";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/ownership/purchases")({
  head: () => ({ meta: [{ title: "Purchases — Tag Ownership" }] }),
  component: PurchasesLayout,
});

function PurchasesLayout() {
  const { enabled } = useReceiptsEnabled();
  if (!enabled) {
    return (
      <div className="space-y-8">
        <PageHeader title="Receipts" description="Your digital receipts and purchase history in one place." />
        <ReceiptsDisabled />
      </div>
    );
  }
  return <Outlet />;
}
