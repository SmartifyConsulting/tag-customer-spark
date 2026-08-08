import { useEffect, useRef, useState } from "react";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"];

export function useBarcodeScanner(onDetected: (code: string) => void, resetKey: unknown = 0) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const detectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const stopCamera = () => {
      try {
        stopRef.current();
      } catch {}
      stopRef.current = () => {};
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const startCamera = async () => {
      if (cancelled || document.hidden || streamRef.current) return;
      detectedRef.current = false;
      setError(null);
      setStarting(true);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled || document.hidden) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const handleDetected = (code: string) => {
          if (cancelled || detectedRef.current) return;
          detectedRef.current = true;
          onDetected(code);
        };

        const AnyWindow = window as unknown as { BarcodeDetector?: any };
        if (AnyWindow.BarcodeDetector) {
          const detector = new AnyWindow.BarcodeDetector({ formats: FORMATS });
          let raf = 0;
          const tick = async () => {
            if (cancelled || detectedRef.current || !videoRef.current) return;
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
          const controls = await reader.decodeFromStream(stream, videoRef.current!, (result) => {
            if (result) handleDetected(result.getText());
          });
          stopRef.current = () => controls.stop();
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Camera unavailable");
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    // Release the camera the instant the tab/app is backgrounded — a
    // getUserMedia stream otherwise keeps running (and the camera indicator
    // lit) even while the user has switched away — and re-acquire it when
    // they come back, as long as this component is still mounted.
    const handleVisibility = () => {
      if (document.hidden) stopCamera();
      else startCamera();
    };

    startCamera();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  return { videoRef, error, starting };
}
