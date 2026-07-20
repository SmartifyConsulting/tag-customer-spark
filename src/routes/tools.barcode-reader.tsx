import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, ScanLine } from "lucide-react";
import { TagLogo } from "@/components/tag-logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/tools/barcode-reader")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Tag Barcode Reader" },
      {
        name: "description",
        content:
          "Point your phone camera at any product barcode to look up the item on Tag.",
      },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: BarcodeReaderPage,
});

function BarcodeReaderPage() {
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

  const looksLikeGtin = detected && /^\d{8,14}$/.test(detected);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-md flex-col items-center px-4 pt-8 pb-6">
        <TagLogo variant="wordmark" heightClass="h-24" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">Tag Barcode Reader</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Point your camera at any product barcode. Detection happens automatically.
        </p>
      </div>

      <div className="mx-auto w-full max-w-md px-4">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-black aspect-[3/4]">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-1/4 w-4/5 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
          {starting && !detected && (
            <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
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

        {detected && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Detected</p>
            <p className="mt-1 break-all font-mono text-lg font-semibold">{detected}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {looksLikeGtin && (
                <Button asChild>
                  <a href={`/passport/${detected}`}>
                    <ScanLine className="mr-2 h-4 w-4" /> Look up product
                  </a>
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  setDetected(null);
                  setNonce((n) => n + 1);
                }}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Scan again
              </Button>
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Powered by <span className="font-semibold">Tag</span> · Retail Intelligence
        </p>
      </div>
    </div>
  );
}
