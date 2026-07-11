import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Bell, MessageCircle, ShieldCheck, Tag as TagIcon } from "lucide-react";
import { getPublicScan } from "@/lib/scan.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotifySheet } from "@/components/scan/notify-sheet";

export const Route = createFileRoute("/scan/$shortCode")({
  ssr: false,
  loader: async ({ params }) => {
    const row = await getPublicScan({ data: { shortCode: params.shortCode } });
    if (!row) throw notFound();
    return row;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.product_name} — ${loaderData.retailer_name}` },
          {
            name: "description",
            content: `Get a WhatsApp ping if ${loaderData.product_name} drops in price, restocks, or hits promo.`,
          },
          { property: "og:title", content: `${loaderData.product_name} — ${loaderData.retailer_name}` },
          { property: "og:image", content: loaderData.image_url ?? "" },
        ]
      : [{ title: "Tag" }],
  }),
  notFoundComponent: () => (
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
  ),
  errorComponent: () => (
    <div className="min-h-screen grid place-items-center px-4">
      <p className="text-sm text-muted-foreground">Couldn't load this page. Please try again.</p>
    </div>
  ),
  component: ScanLanding,
});

function fmtPrice(cents: number | null | undefined, currency: string) {
  if (cents == null) return "";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)}`;
  }
}

function ScanLanding() {
  const data = Route.useLoaderData();
  const [open, setOpen] = useState(false);

  const price = data.price_cents;
  const onSale =
    data.sale_price_cents != null && price != null && data.sale_price_cents < price;
  const currency = data.currency ?? "ZAR";
  const heroImage =
    data.image_url ??
    (Array.isArray(data.images) && (data.images as any[])[0]?.url) ??
    null;

  const discountPct =
    onSale && price != null
      ? Math.round(((price - (data.sale_price_cents ?? 0)) / price) * 100)
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/50 via-background to-background pb-32">
      {/* Brand bar */}
      <header className="sticky top-0 z-20 backdrop-blur bg-background/80 border-b border-border/60">
        <div className="mx-auto max-w-md flex h-14 items-center gap-3 px-4">
          {data.retailer_logo ? (
            <img
              src={data.retailer_logo}
              alt={data.retailer_name ?? ""}
              className="h-7 w-7 rounded-md object-cover"
            />
          ) : (
            <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-bold">
              {(data.retailer_name ?? "?").slice(0, 1)}
            </div>
          )}
          <div className="leading-tight">
            <p className="text-sm font-semibold">{data.retailer_name}</p>
            {data.store_name && (
              <p className="text-[11px] text-muted-foreground">{data.store_name}</p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm"
        >
          {heroImage ? (
            <img
              src={heroImage}
              alt={data.product_name ?? ""}
              className="aspect-[4/5] w-full object-cover"
            />
          ) : (
            <div className="aspect-[4/5] w-full bg-muted grid place-items-center">
              <TagIcon className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          {onSale && (
            <Badge className="absolute top-3 left-3 bg-[color:var(--success)] text-[color:var(--success-foreground)] hover:bg-[color:var(--success)]">
              −{discountPct}% on sale
            </Badge>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-5"
        >
          {data.product_brand && (
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              {data.product_brand}
            </p>
          )}
          <h1 className="mt-0.5 text-2xl font-semibold leading-tight">
            {data.product_name}
          </h1>

          <div className="mt-3 flex items-baseline gap-2.5">
            {onSale ? (
              <>
                <span className="text-2xl font-bold text-[color:var(--success)]">
                  {fmtPrice(data.sale_price_cents, currency)}
                </span>
                <span className="text-base text-muted-foreground line-through">
                  {fmtPrice(data.price_cents, currency)}
                </span>
              </>
            ) : (
              <span className="text-2xl font-bold">
                {fmtPrice(data.price_cents, currency)}
              </span>
            )}
          </div>

          {data.product_description && (
            <p className="mt-3 text-sm text-foreground/80 leading-relaxed">
              {data.product_description}
            </p>
          )}

          {(data.color || data.size) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.color && <Badge variant="secondary">{data.color}</Badge>}
              {data.size && <Badge variant="secondary">Size {data.size}</Badge>}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 rounded-2xl border border-border bg-card p-4"
        >
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--success)]/12 text-[color:var(--success)]">
              <Bell className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Don't miss the price drop</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                We'll send you one WhatsApp when this product goes on sale, restocks, or has a promo.
              </p>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Sticky CTA */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-md">
          <Button
            size="lg"
            className="w-full h-12 text-base shadow-lg shadow-primary/20"
            onClick={() => setOpen(true)}
          >
            <MessageCircle className="mr-2 h-5 w-5" />
            Notify me on WhatsApp
          </Button>
          <p className="mt-2 flex items-center gap-1.5 justify-center text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            One product, one ping. Unsubscribe anytime.
          </p>
        </div>
      </div>

      <NotifySheet
        open={open}
        onOpenChange={setOpen}
        shortCode={data.short_code!}
        productName={data.product_name ?? "this product"}
        retailerName={data.retailer_name ?? "the retailer"}
      />
    </div>
  );
}
