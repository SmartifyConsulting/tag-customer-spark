import { createFileRoute } from "@tanstack/react-router";
import { CustomersView } from "@/components/customers/customers-view";

// Kept as a top-level route (Admin → Customers tab is the canonical
// destination now; this route stays so existing deep links keep working).
export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Customers — Tag" }] }),
  component: () => <CustomersView />,
});
