import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, MoreVertical, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TagLogo } from "@/components/tag-logo";

export const Route = createFileRoute("/install")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Install Tag — Tag" },
      {
        name: "description",
        content: "Add Tag to your home screen for one-tap access to your watchlist and WhatsApp alerts.",
      },
    ],
  }),
  component: InstallPage,
});

type Platform = "ios" | "android" | "desktop";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) && !(window as any).MSStream) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

// Chrome only fires this if the PWA install criteria (manifest + service
// worker + served over https) are already met — captured once at module
// load isn't reliable, so we listen from the very first render.
function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    if (window.matchMedia?.("(display-mode: standalone)").matches) setInstalled(true);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return { canPrompt: !!deferredPrompt, installed, promptInstall };
}

function InstallPage() {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const { canPrompt, installed, promptInstall } = useInstallPrompt();
  const [showAndroidSteps, setShowAndroidSteps] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-6 py-12 text-center text-foreground">
      <TagLogo variant="wordmark" size="lg" heightClass="h-24" className="mb-8" />

      {installed ? (
        <>
          <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-[color:var(--success)]/15 text-[color:var(--success)]">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Tag is already on your home screen</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            You're all set — open it from your home screen any time to check your watchlist.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold tracking-tight">Add Tag to your home screen</h1>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            One tap gets you back to your watched products and WhatsApp alerts — no browser tabs,
            no searching.
          </p>

          <div className="mt-8 w-full max-w-sm">
            {platform === "android" && (
              <div className="rounded-2xl border border-border/60 bg-card p-6">
                <Button
                  size="lg"
                  className="w-full gap-2"
                  onClick={canPrompt ? promptInstall : () => setShowAndroidSteps(true)}
                >
                  <Download className="h-4 w-4" /> Install Tag
                </Button>
                {!canPrompt && showAndroidSteps && (
                  <ol className="mt-5 space-y-3 text-left text-sm">
                    <li className="flex gap-3">
                      <span className="font-bold text-primary">1.</span>
                      Tap <MoreVertical className="mx-1 inline h-4 w-4" /> in your browser's menu
                    </li>
                    <li className="flex gap-3">
                      <span className="font-bold text-primary">2.</span>
                      Choose <span className="font-medium text-foreground">"Add to Home screen"</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-bold text-primary">3.</span>
                      Confirm — Tag appears on your home screen
                    </li>
                  </ol>
                )}
              </div>
            )}

            {platform === "ios" && (
              <div className="rounded-2xl border border-border/60 bg-card p-6">
                <ol className="space-y-3 text-left text-sm">
                  <li className="flex gap-3">
                    <span className="font-bold text-primary">1.</span>
                    Tap the Share icon <Share className="mx-1 inline h-4 w-4" /> in Safari's toolbar
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-primary">2.</span>
                    Scroll down and tap{" "}
                    <span className="whitespace-nowrap font-medium text-foreground">
                      "Add to Home Screen" <SquarePlus className="inline h-4 w-4" />
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="font-bold text-primary">3.</span>
                    Tap <span className="font-medium text-foreground">Add</span> — Tag appears on
                    your home screen
                  </li>
                </ol>
              </div>
            )}

            {platform === "desktop" && (
              <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
                Open this page on your phone to add Tag to your home screen — from your camera,
                scan the QR code you got with your product, or open the link we sent on WhatsApp.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
