import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { capturePaypalOrder, getMySubscription } from "@/lib/billing.functions";

type Status = "loading" | "success" | "cancelled" | "error" | "pending";

export function PaymentReturnScreen({
  provider,
  orderId,
  cancelled,
}: {
  provider: "paypal" | "payfast";
  orderId?: string;
  cancelled: boolean;
}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>(cancelled ? "cancelled" : "loading");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (cancelled || started.current) return;
    started.current = true;
    let stop = false;

    if (provider === "paypal") {
      if (!orderId) {
        setStatus("error");
        setMessage("Missing PayPal order reference.");
        return;
      }
      capturePaypalOrder({ data: { order_id: orderId } })
        .then(() => {
          setStatus("success");
          qc.invalidateQueries({ queryKey: ["my-subscription"] });
        })
        .catch((e: Error) => {
          setStatus("error");
          setMessage(e.message || "Could not finalise your payment.");
        });
      return;
    }

    // PayFast: plan is granted by the ITN notification — poll for it (~30s).
    let attempts = 0;
    const tick = async () => {
      if (stop) return;
      attempts++;
      try {
        const res = await getMySubscription();
        const latest = (res.purchases as Array<{ provider: string; status: string }>).find(
          (p) => p.provider === "payfast",
        );
        if (latest?.status === "completed") {
          setStatus("success");
          qc.invalidateQueries({ queryKey: ["my-subscription"] });
          return;
        }
        if (latest?.status === "failed") {
          setStatus("error");
          setMessage("Payment was not completed.");
          return;
        }
      } catch {
        /* keep polling */
      }
      if (attempts >= 15) setStatus("pending");
      else setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [provider, orderId, cancelled, qc]);

  const name = provider === "paypal" ? "PayPal" : "PayFast";

  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center text-card-foreground shadow-sm">
        {status === "loading" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <h1 className="mt-4 text-lg font-semibold">Finalising your payment…</h1>
            <p className="mt-1 text-sm text-muted-foreground">One moment while we confirm with {name}.</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 text-lg font-semibold">Payment confirmed</h1>
            <p className="mt-1 text-sm text-muted-foreground">Your plan has been upgraded.</p>
          </>
        )}
        {status === "pending" && (
          <>
            <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-4 text-lg font-semibold">Payment received — still confirming</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {name} hasn't confirmed yet. Your plan will update automatically within a few minutes.
            </p>
          </>
        )}
        {status === "cancelled" && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-4 text-lg font-semibold">Payment cancelled</h1>
            <p className="mt-1 text-sm text-muted-foreground">No money was taken. You can pick a plan again any time.</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-4 text-lg font-semibold">We couldn't finish your payment</h1>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </>
        )}
        {status !== "loading" && (
          <div className="mt-6 flex justify-center gap-2">
            <Button asChild variant="outline">
              <Link to="/plan">Plans</Link>
            </Button>
            <Button asChild>
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
