import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MessageCircle, ScanBarcode, X } from "lucide-react";
import { toast } from "sonner";
import { TagLogo } from "@/components/tag-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/shop")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { gtin?: string } =>
    typeof search['gtin'] === "string" && /^\d{8,14}$/.test(search['gtin'])
      ? { gtin: search['gtin'] }
      : {},
  head: () => ({
    meta: [
      { title: "TAG as you shop — scan many products at once" },
      { name: "description", content: "Scan several products in store and get WhatsApp updates for all of them in one tap." },
      { property: "og:title", content: "TAG as you shop" },
      { property: "og:description", content: "Scan several products and follow them all on WhatsApp in one tap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  component: ShopPage,
});

type Item = { gtin: string; name: string; priceCents: number | null; image: string | null };

function formatPrice(c: number | null) {
  return c == null ? "" : `R ${(c / 100).toFixed(2)}`;
}

function ShopPage() {
  const { gtin } = Route.useSearch();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  const pending = useRef(new Set<string>());
  const lastRead = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [phone, setPhone] = useState("+27");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const onCode = useCallback(async (raw: string) => {
      const code = raw.replace(/\D/g, "");
      if (!/^\d{8,14}$/.test(code)) return;
      const now = Date.now();
      if (lastRead.current.code === code && now - lastRead.current.at < 1500) return;
      lastRead.current = { code, at: now };
      if (itemsRef.current.some((i) => i.gtin === code)) {
        setFlash(code);
        setTimeout(() => setFlash(null), 900);
        return;
      }
      if (pending.current.has(code)) return;
      pending.current.add(code);
      try {
        const res = await fetch(`/api/public/scan/lookup?gtin=${code}`);
        const json = await res.json();
        if (!json.ok) {
          toast.error(`${code}: ${json.error ?? "Not found"}`);
          return;
        }
        navigator.vibrate?.(80);
        setItems((prev) => (prev.some((i) => i.gtin === code) ? prev : [...prev, json.product]));
      } catch {
        toast.error("Could not look up that product");
      } finally {
        pending.current.delete(code);
      }
  }, []);

  useEffect(() => {
    if (gtin) void onCode(gtin);
  }, [gtin, onCode]);

  useEffect(() => {
    if (done) return;
    let cancelled = false;
    let stop = () => {};
    let stream: MediaStream | null = null;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        const W = window as unknown as { BarcodeDetector?: any };
        if (W.BarcodeDetector) {
          const det = new W.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "itf"] });
          let raf = 0;
          const tick = async () => {
            if (cancelled || !videoRef.current) return;
            try {
              const codes = await det.detect(videoRef.current);
              if (codes?.[0]?.rawValue) onCode(String(codes[0].rawValue));
            } catch {}
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
          stop = () => cancelAnimationFrame(raf);
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (cancelled) return;
          const video = videoRef.current;
          if (!video) return;
          const controls = await new BrowserMultiFormatReader().decodeFromStream(stream, video, (r) => {
            if (r) onCode(r.getText());
          });
          stop = () => controls.stop();
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Camera unavailable");
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      try { stop(); } catch {}
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [done, onCode]);

  const submit = async () => {
    if (!items.length) return;
    setSubmitting(true);
    let ok = 0;
    let warning: string | null = null;
    for (const [i, item] of items.entries()) {
      try {
        const res = await fetch("/api/public/scan/barcode-interest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // One WhatsApp confirmation for the whole list (first item).
          body: JSON.stringify({ gtin: item.gtin, whatsapp: phone.replace(/\s/g, ""), silent: i > 0 }),
        });
        const json = await res.json();
        if (json.ok) {
          ok++;
          if (json.warning) warning = json.warning;
        } else if (json.error === "Invalid phone number") {
          toast.error("Please enter a valid WhatsApp number");
          setSubmitting(false);
          return;
        }
      } catch {}
    }
    setSubmitting(false);
    if (!ok) return toast.error("We couldn't save your list. Please try again.");
    if (warning) toast.warning(warning);
    setDone(true);
  };

  if (done) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6 text-center text-foreground">
        <div className="max-w-sm">
          <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
          <h1 className="mt-4 text-2xl font-bold">You're following {items.length} products</h1>
          <p className="mt-2 text-sm text-muted-foreground">We'll message you on WhatsApp about price drops and stock.</p>
          <Button className="mt-6" onClick={() => { itemsRef.current = []; lastRead.current = { code: "", at: 0 }; setItems([]); setDone(false); }}><ScanBarcode className="mr-2 h-4 w-4" />TAG another product</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-40 text-foreground">
      <div className="mx-auto flex max-w-md flex-col items-center px-4 pt-6 pb-4">
        <TagLogo variant="wordmark" heightClass="h-16" />
        <h1 className="mt-3 text-2xl font-bold tracking-tight">TAG as you shop</h1>
      </div>

      <div className="mx-auto w-full max-w-md px-4">
        <div id="scanner" className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-border bg-foreground">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-1/3 w-4/5 rounded-lg border-2 border-primary" />
          </div>
          {starting && (
            <div className="absolute inset-0 grid place-items-center text-background"><Loader2 className="h-6 w-6 animate-spin" /></div>
          )}
          {error && (
            <div className="absolute inset-0 grid place-items-center bg-foreground/80 p-4 text-center text-sm text-background">
              <div><p className="font-medium">Cannot access the camera</p><p className="mt-1 text-xs opacity-80">{error}</p></div>
            </div>
          )}
        </div>

        <h2 className="mt-5 text-lg font-semibold">Your TAG list ({items.length})</h2>
        {items.length > 0 && (
          <Button variant="outline" className="mt-3 w-full" onClick={() => videoRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' })}>
            <ScanBarcode className="mr-2 h-4 w-4" />TAG another product
          </Button>
        )}
        {items.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Scanned products will appear here.</p>}
        <ul className="mt-2 space-y-2">
          {items.map((it) => (
            <li key={it.gtin} className={`flex items-center gap-3 rounded-xl border bg-card p-2 transition ${flash === it.gtin ? "border-primary ring-2 ring-primary" : "border-border"}`}>
              {it.image ? <img src={it.image} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="h-12 w-12 rounded-lg bg-muted" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{it.name}</p>
                <p className="text-sm text-muted-foreground">{formatPrice(it.priceCents)}</p>
              </div>
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <Button variant="ghost" size="icon" aria-label={`Remove ${it.name}`} onClick={() => setItems((p) => p.filter((x) => x.gtin !== it.gtin))}>
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </div>

      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-4">
          <div className="mx-auto max-w-md space-y-2">
            <Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+27 82 123 4567" aria-label="WhatsApp number" />
            <Button className="w-full" size="lg" disabled={submitting || phone.replace(/\D/g, "").length < 9} onClick={submit}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
              Get WhatsApp updates for all {items.length} product{items.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
