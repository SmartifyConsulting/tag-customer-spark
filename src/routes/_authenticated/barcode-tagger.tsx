import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { QrPreview } from "@/components/qr/qr-preview";
import { getMyShopperTag } from "@/lib/ownership.functions";

export const Route = createFileRoute("/_authenticated/barcode-tagger")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Tag — Tag" },
      {
        name: "description",
        content: "Your personal QR code, and a barcode scanner to tag products.",
      },
    ],
  }),
  component: BarcodeTaggerPage,
});

function BarcodeTaggerPage() {
  const [detected, setDetected] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const { videoRef, error, starting } = useBarcodeScanner((code) => setDetected(code), nonce);

  const tagFn = useServerFn(getMyShopperTag);
  const { data: myTag } = useQuery({ queryKey: ["my-shopper-tag"], queryFn: () => tagFn() });
  const qrValue = useMemo(() => {
    if (!myTag?.tagId) return null;
    return JSON.stringify({ tagId: myTag.tagId, email: myTag.email ?? undefined });
  }, [myTag]);

  const looksLikeGtin = !!detected && /^\d{8,14}$/.test(detected);

  useEffect(() => {
    if (!detected || !looksLikeGtin) return;
    const t = setTimeout(() => {
      window.location.href = `/passport/${detected}`;
    }, 400);
    return () => clearTimeout(t);
  }, [detected, looksLikeGtin]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">My Tag</h1>
          <p className="mt-2 text-muted-foreground">
            Your personal QR code, and a barcode scanner ready to tag any product.
          </p>
        </div>

        {/* My QR Code — auto-generated at sign-up */}
        {qrValue && (
          <Card className="mb-6 flex flex-col items-center gap-3 p-6 sm:flex-row sm:justify-center">
            <QrPreview value={qrValue} size={140} />
            <div className="text-center sm:text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                My Shopper Tag
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-primary">{myTag?.tagId}</p>
              {myTag?.email && <p className="text-sm text-muted-foreground">{myTag.email}</p>}
            </div>
          </Card>
        )}

        {/* Main Content Grid - Responsive Layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Video Feed - Takes full width on mobile, 2/3 on desktop */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <div className="relative overflow-hidden rounded-lg bg-black aspect-video md:aspect-square">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                {/* Scanning Frame Overlay */}
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="h-1/3 w-2/3 rounded-lg border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
                {/* Loading State */}
                {starting && !detected && (
                  <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <p className="text-sm">Starting camera...</p>
                    </div>
                  </div>
                )}
                {/* Error State */}
                {error && (
                  <div className="absolute inset-0 grid place-items-center bg-black/70 p-4 text-center text-sm text-white">
                    <div>
                      <p className="font-medium">Cannot access the camera</p>
                      <p className="mt-1 text-xs opacity-80">{error}</p>
                      <p className="mt-2 text-xs opacity-80">
                        Allow camera permission for this site, then reload.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Detected Barcode Panel - Sidebar on desktop, below on mobile */}
          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-6">
              {detected ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                      Detected Barcode
                    </p>
                    <p className="mt-2 break-all font-mono text-lg font-semibold text-primary">
                      {detected}
                    </p>
                  </div>

                  {looksLikeGtin && (
                    <div className="rounded-lg bg-primary/10 p-3">
                      <p className="flex items-center gap-2 text-sm text-primary font-medium">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Redirecting to product...
                      </p>
                    </div>
                  )}

                  {!looksLikeGtin && (
                    <div className="rounded-lg bg-warning/10 p-3">
                      <p className="text-sm text-warning">
                        This doesn't look like a valid product barcode. Try again.
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={() => {
                      setDetected(null);
                      setNonce((n) => n + 1);
                    }}
                    className="w-full"
                    variant="outline"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Scan Again
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 text-center">
                  <div className="text-5xl">📱</div>
                  <div>
                    <p className="font-semibold">Ready to tag</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Position a barcode in the camera frame
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
