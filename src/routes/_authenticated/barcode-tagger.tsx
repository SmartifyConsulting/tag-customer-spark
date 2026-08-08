import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/barcode-tagger")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Barcode Tagger — Tag" },
      {
        name: "description",
        content: "Scan product barcodes to tag items and look them up.",
      },
    ],
  }),
  component: BarcodeTaggerPage,
});

function BarcodeTaggerPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [detected, setDetected] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (detected) return;
    let cancelled = false;
    setError(null);
    setStarting(true);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const handleDetected = (code: string) => {
          if (cancelled) return;
          setDetected(code);
        };

        const AnyWindow = window as unknown as { BarcodeDetector?: any };
        if (AnyWindow.BarcodeDetector) {
          const detector = new AnyWindow.BarcodeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"],
          });
          let raf = 0;
          const tick = async () => {
            if (cancelled || !videoRef.current) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes && codes[0]?.rawValue) {
                handleDetected(String(codes[0].rawValue));
                return;
              }
            } catch {}
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
          stopRef.current = () => cancelAnimationFrame(raf);
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (cancelled) return;
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromStream(
            stream,
            videoRef.current!,
            (result) => {
              if (result) handleDetected(result.getText());
            },
          );
          stopRef.current = () => controls.stop();
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Camera unavailable");
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        stopRef.current();
      } catch {}
      stopRef.current = () => {};
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [detected, nonce]);

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
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Barcode Tagger</h1>
          <p className="mt-2 text-muted-foreground">
            Point your camera at any product barcode. Detection happens automatically.
          </p>
        </div>

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
