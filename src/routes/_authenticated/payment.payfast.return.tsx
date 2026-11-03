import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PaymentReturnScreen } from "@/components/settings/payment-return-screen";

export const Route = createFileRoute("/_authenticated/payment/payfast/return")({
  head: () => ({ meta: [{ title: "Finalising PayFast payment — Tag" }] }),
  validateSearch: (s) => z.object({ cancelled: z.coerce.string().optional() }).parse(s),
  component: () => {
    const s = Route.useSearch();
    return <PaymentReturnScreen provider="payfast" cancelled={!!s.cancelled} />;
  },
});
