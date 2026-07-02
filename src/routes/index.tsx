import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

import { ArrowRight, QrCode, MessageCircle, TrendingUp, Sparkles, Bell, BarChart3 } from "lucide-react";
import logoAsset from "@/assets/tag-logo.png.asset.json";
import heroLogo from "@/assets/tag-logo-hero.png.asset.json";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Tag — Recover lost in-store sales" },
      { name: "description", content: "Tag helps retailers reconnect with in-store shoppers via WhatsApp when products go on sale, restock, or run low." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setChecked(true);
    });
  }, []);

  const primaryHref = authed ? "/dashboard" : "/auth";
  const primaryLabel = authed ? "Open dashboard" : "Sign in";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="mx-auto flex max-w-7xl items-start justify-between px-6 py-5">
        <img src={heroLogo.url} alt="Tag" className="h-[240px] w-auto object-contain mt-[57px]" />
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex mt-3">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#intelligence" className="hover:text-foreground">Intelligence</a>
        </nav>
        <div className="flex items-center gap-2 mt-3">
          <Button onClick={() => navigate({ to: primaryHref })} className="gap-2">
            {primaryLabel} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--primary)/0.10),transparent_70%)]" />
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <div className="flex flex-col justify-center">
            <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Retail engagement, reimagined
            </span>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Turn in-store curiosity into <span className="text-primary">recovered revenue.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Tag lets shoppers scan a product QR, opt into WhatsApp, and get notified the moment that item goes on sale, restocks, or runs low. The result: sales you used to lose at the door.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => navigate({ to: primaryHref })} className="gap-2">
                {primaryLabel} <ArrowRight className="h-4 w-4" />
              </Button>
              <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                See how it works →
              </a>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6 border-t border-border/60 pt-6 text-sm">
              <div>
                <div className="text-2xl font-bold text-foreground">3.2×</div>
                <div className="text-muted-foreground">Recovered revenue</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">42%</div>
                <div className="text-muted-foreground">Opt-in rate</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">98%</div>
                <div className="text-muted-foreground">WhatsApp open rate</div>
              </div>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/10 to-transparent blur-2xl" />
            <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-xl">
              <div className="flex items-center gap-3 border-b border-border/60 pb-4">
                <img src={logoAsset.url} alt="" className="h-10 w-10 object-contain" />
                <div>
                  <div className="text-sm font-semibold">Tag · WhatsApp</div>
                  <div className="text-xs text-muted-foreground">Notification preview</div>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm">
                  Hi Georgia 👋 The Linen Trench you scanned at Sandton is now <b>20% off</b> until Sunday. Reserve in one tap.
                </div>
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground shadow-sm">
                  Only 3 left in your size. Want us to hold one for you?
                </div>
                <div className="mr-auto max-w-[85%] rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm">
                  Yes please — I'll come by tomorrow.
                </div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border/60 pt-4 text-center text-xs">
                <div className="rounded-lg bg-muted/60 py-2"><div className="font-semibold text-foreground">Scanned</div><div className="text-muted-foreground">Today 14:02</div></div>
                <div className="rounded-lg bg-muted/60 py-2"><div className="font-semibold text-foreground">Notified</div><div className="text-muted-foreground">+3 days</div></div>
                <div className="rounded-lg bg-success/10 py-2"><div className="font-semibold text-success">Recovered</div><div className="text-muted-foreground">R 4,290</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Built for modern retail floors</h2>
          <p className="mt-3 text-muted-foreground">Every scan is an opt-in. Every opt-in becomes a recoverable sale.</p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: QrCode, title: "Smart QR Tags", body: "Generate, print and track unique QR codes for every product on the floor." },
            { icon: MessageCircle, title: "WhatsApp Engine", body: "Reach shoppers on the channel they actually read — with 98% open rates." },
            { icon: Bell, title: "Restock & Sale Alerts", body: "Trigger notifications when stock drops, restocks land, or promotions launch." },
            { icon: TrendingUp, title: "ROI Attribution", body: "See exactly how much revenue each scan and notification has recovered." },
            { icon: BarChart3, title: "Intent Score", body: "A 0–100 score per product based on real customer interest signals." },
            { icon: Sparkles, title: "AI Retail Intelligence", body: "Daily AI briefings, opportunity feeds, and campaign drafting baked in." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border/60 bg-card p-6 transition hover:border-primary/40 hover:shadow-md">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-base font-semibold">{title}</div>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How */}
      <section id="how" className="bg-muted/40 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">From scan to sale in four steps</h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-4">
            {[
              { n: "01", t: "Tag your products", d: "Print QR cards with your logo, product image and short message." },
              { n: "02", t: "Shoppers scan", d: "A mobile-first landing lets them opt into WhatsApp in seconds." },
              { n: "03", t: "You notify", d: "Send sale, restock, and low-stock alerts from a single composer." },
              { n: "04", t: "Revenue returns", d: "Track recovered sales and ROI per campaign automatically." },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl border border-border/60 bg-card p-6">
                <div className="text-xs font-semibold text-primary">{s.n}</div>
                <div className="mt-2 text-base font-semibold">{s.t}</div>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="intelligence" className="mx-auto max-w-7xl px-6 py-24 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to recover the sales walking out the door?</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Join retailers using Tag to turn every store visit into a long-term customer relationship.
        </p>
        <div className="mt-8 flex justify-center">
          <Button size="lg" onClick={() => navigate({ to: primaryHref })} className="gap-2">
            {primaryLabel} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Tag. Built for South African retail and beyond.
      </footer>
    </div>
  );
}
