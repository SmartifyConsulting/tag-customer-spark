import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Loader2, MessageCircle, Tag as TagIcon } from "lucide-react";
import { getChatStartInfo } from "@/lib/chat-start.functions";
import { scanChatMessage, whatsappChatUrl } from "@/lib/whatsapp-chat-link";
import { Button } from "@/components/ui/button";

// Landing page for a phone-camera QR scan. Jumps straight into a WhatsApp chat
// with TAG (pre-filled message carrying the product ref) so the shopper only
// has to tap Send. If WhatsApp doesn't take over, explains that it is needed.

const searchSchema = z.object({
  g: z.string().optional(),
  t: z.string().optional(),
});

export const Route = createFileRoute("/start-chat")({
  ssr: false,
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ g: search.g, t: search.t }),
  loader: async ({ deps }) =>
    getChatStartInfo({ data: { gtin: deps.g, shortCode: deps.t } }),
  head: () => ({
    meta: [
      { title: "Opening WhatsApp — TAG" },
      { name: "robots", content: "noindex" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
  errorComponent: () => (
    <div className="min-h-screen grid place-items-center px-4">
      <p className="text-sm text-muted-foreground">Couldn't load this page. Please try again.</p>
    </div>
  ),
  component: StartChat,
});

type Phase = "opening" | "opened" | "missing";

const OPEN_TIMEOUT_MS = 2500;

function storeUrl(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return /iPhone|iPad|iPod/i.test(ua)
    ? "https://apps.apple.com/app/whatsapp-messenger/id310633997"
    : "https://play.google.com/store/apps/details?id=com.whatsapp";
}

function StartChat() {
  const info = Route.useLoaderData();
  const { g, t } = Route.useSearch();
  const [phase, setPhase] = useState<Phase>("opening");
  const opened = useRef(false);

  const chatUrl = useMemo(
    () =>
      info
        ? whatsappChatUrl(
            info.numberDigits,
            scanChatMessage(info.productName, info.target, info.retailerName),
          )
        : null,
    [info],
  );

  useEffect(() => {
    if (!chatUrl) return;

    // Once WhatsApp takes over the screen the page is hidden. If we come back
    // (or never left) the chat didn't open.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        opened.current = true;
        setPhase("opened");
      }
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && !opened.current) setPhase("missing");
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);

    window.location.href = chatUrl;
    const timer = window.setTimeout(() => {
      if (!opened.current) setPhase("missing");
    }, OPEN_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [chatUrl]);

  if (!info || !chatUrl) {
    return (
      <div className="min-h-screen grid place-items-center bg-muted/40 px-4">
        <div className="max-w-sm text-center rounded-2xl bg-card border border-border p-8 shadow-sm">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-muted">
            <TagIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <h1 className="text-lg font-semibold">This tag isn't active</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask a sales assistant for help — they can re-generate the QR code.
          </p>
        </div>
      </div>
    );
  }

  const viewHref = t ? `/scan/${t}` : `/passport/${g}?src=web`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/50 via-background to-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center gap-3 px-4">
          {info.retailerLogo ? (
            <img src={info.retailerLogo} alt={info.retailerName ?? ""} className="h-7 w-7 rounded-md object-cover" />
          ) : (
            <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              {(info.retailerName ?? "T").slice(0, 1)}
            </div>
          )}
          <p className="text-sm font-semibold">{info.retailerName ?? "TAG"}</p>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-16 text-center">
        {phase === "opening" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <h1 className="mt-4 text-lg font-semibold">Opening WhatsApp…</h1>
            <p className="mt-1 text-sm text-muted-foreground">{info.productName}</p>
          </>
        )}

        {phase === "opened" && (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[color:var(--success)]/15 text-[color:var(--success)]">
              <MessageCircle className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-lg font-semibold">Tap Send in WhatsApp</h1>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
              Your message about {info.productName} is ready. Send it and we'll keep you posted.
            </p>
            <Button className="mt-6 w-full h-12" asChild>
              <a href={chatUrl}>
                <MessageCircle className="mr-2 h-5 w-5" /> Open WhatsApp again
              </a>
            </Button>
          </>
        )}

        {phase === "missing" && (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
              <MessageCircle className="h-7 w-7" />
            </div>
            <h1 className="mt-4 text-lg font-semibold">WhatsApp needs to be installed</h1>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
              To receive updates on {info.productName}, you'll need WhatsApp on your phone.
            </p>
            <div className="mt-6 space-y-3">
              <Button className="w-full h-12" asChild>
                <a href={storeUrl()}>Get WhatsApp</a>
              </Button>
              <Button variant="outline" className="w-full h-12" asChild>
                <a href={chatUrl}>I've installed it — open chat</a>
              </Button>
            </div>
            <p className="mt-6 text-sm">
              <a href={viewHref} className="text-muted-foreground underline">
                View product instead
              </a>
            </p>
          </>
        )}
      </main>
    </div>
  );
}
