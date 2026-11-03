import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PaymentReturnScreen } from "@/components/settings/payment-return-screen";

export const Route = createFileRoute("/_authenticated/payment/paypal/return")({
  head: () => ({ meta: [{ title: "Finalising PayPal payment — Tag" }] }),
  validateSearch: (s) =>
    z.object({ token: z.string().optional(), cancelled: z.coerce.string().optional() }).parse(s),
  component: () => {
    const s = Route.useSearch();
    return <PaymentReturnScreen provider="paypal" orderId={s.token} cancelled={!!s.cancelled} />;
  },
});
