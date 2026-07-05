import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetect: (code: string) => void;
};

export function BarcodeScannerDialog({ open, onOpenChange, onDetect }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
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
          onDetect(code);
          onOpenChange(false);
        };

        // Prefer native BarcodeDetector
        const AnyWindow = window as unknown as { BarcodeDetector?: any };
        if (AnyWindow.BarcodeDetector) {
          const detector = new AnyWindow.BarcodeDetector({
            formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code", "itf"],
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
          // Fallback: ZXing
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
  }, [open, onDetect, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Scan barcode</DialogTitle>
          <DialogDescription>
            Point your camera at the product barcode. Detection happens automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="relative overflow-hidden rounded-xl bg-black aspect-[4/3]">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-1/3 w-3/4 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
          {starting && (
            <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 grid place-items-center bg-black/70 p-4 text-center text-sm text-white">
              <div>
                <p className="font-medium">Cannot access the camera</p>
                <p className="mt-1 text-xs opacity-80">{error}</p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" /> Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
