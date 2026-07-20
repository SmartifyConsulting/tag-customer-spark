import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useState } from "react";
import PhoneInput from "react-phone-number-input";
import { isValidPhoneNumber } from "libphonenumber-js";
import { CheckCircle2, Loader2, MessageCircle, ShieldCheck } from "lucide-react";
import { ProductImage } from "@/components/products/product-image";
import { Button } from "@/components/ui/button";
import "react-phone-number-input/style.css";

// ------- Server: resolve product by GTIN, self-heal, log scan --------------

function validGtin14(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  const g = digits.padStart(14, "0");
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const d = Number(g[i]);
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  if (check !== Number(g[13])) return null;
  return g;
}

const getPublicProductByGtin = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ gtin: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const gtin14 = validGtin14(data.gtin);
    if (!gtin14) return { found: false as const, gtin: data.gtin };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The same manufacturer GTIN can be stocked by multiple retailers, so
    // this can legitimately match more than one row — .maybeSingle() would
    // throw in that case. Bare /passport/{gtin} (no store context) can't
    // disambiguate which retailer's copy the scanner meant, so it
    // deterministically picks the oldest-registered match; a store-linked
    // scan entry point (in progress) will resolve this precisely instead.
    // GTINs can be stored in the DB as the raw input (12 / 13 / 14 digits)
    // depending on the source, but the scanner always resolves them into a
    // padded 14-digit form. Match against both so a QR encoded as e.g.
    // `02007453265190` still finds a product stored as `2007453265190`.
    const gtinCandidates = Array.from(
      new Set([gtin14, gtin14.replace(/^0+/, "") || gtin14, gtin14.slice(1), gtin14.slice(2)]),
    );
    const { data: products } = await supabaseAdmin
      .from("products")
      .select(
        "id, retailer_id, store_id, stock_qty, name, brand, description, gtin, image_url, thumbnail_url, hero_image, image_status, price_cents, sale_price_cents, currency, on_promotion, promotion_label",
      )
      .in("gtin", gtinCandidates)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1);

    const product = products?.[0] ?? null;
    if (!product) {
      console.warn("[passport] no product for gtin", { input: data.gtin, gtin14, tried: gtinCandidates });
      return { found: false as const, gtin: gtin14 };
    }


    // Self-heal: shell passport if missing
    let { data: passport } = await supabaseAdmin
      .from("product_passports")
      .select("*")
      .eq("product_id", (product as any).id)
      .maybeSingle();

    if (!passport) {
      const dppId = crypto.randomUUID();
      await supabaseAdmin.from("product_passports").upsert(
        {
          product_id: (product as any).id,
          retailer_id: (product as any).retailer_id,
          dpp_id: dppId,
          gtin: gtin14,
          status: "published",
          visibility: "public",
          enrichment_status: "pending",
          hero_image: (product as any).hero_image ?? (product as any).image_url ?? null,
          thumbnail: (product as any).thumbnail_url ?? (product as any).image_url ?? null,
        },
        { onConflict: "product_id" },
      );
      await supabaseAdmin
        .from("products")
        .update({ digital_product_passport_id: dppId })
        .eq("id", (product as any).id);
      await supabaseAdmin
        .from("passport_enrichment_queue")
        .upsert({ product_id: (product as any).id, retailer_id: (product as any).retailer_id });
      const { data: p2 } = await supabaseAdmin
        .from("product_passports")
        .select("*")
        .eq("product_id", (product as any).id)
        .maybeSingle();
      passport = p2 as any;
    }

    // Fire-and-forget scan log + intent recompute
    try {
      const { getRequestHeader, getRequest } = await import("@tanstack/react-start/server");
      const ua = getRequestHeader("user-agent") ?? null;
      const referer = getRequestHeader("referer") ?? null;
      const country = getRequestHeader("cf-ipcountry") ?? getRequestHeader("x-vercel-ip-country") ?? null;
      const url = new URL(getRequest().url);
      const device = /Mobi|Android/i.test(ua ?? "") ? "mobile" : "desktop";
      await supabaseAdmin.from("qr_scans").insert({
        product_id: (product as any).id,
        retailer_id: (product as any).retailer_id,
        store_id: (product as any).store_id,
        scanned_at: new Date().toISOString(),
        device_type: device,
        user_agent: ua,
        referrer: referer,
        country,
        utm_source: url.searchParams.get("utm_source"),
        utm_medium: url.searchParams.get("utm_medium"),
        utm_campaign: url.searchParams.get("utm_campaign"),
      });
      await supabaseAdmin.rpc("enqueue_intent_recompute", { _product_id: (product as any).id });
    } catch {
      /* scan logging is best-effort */
    }

    return {
      found: true as const,
      gtin: gtin14,
      product,
      passport,
    };
  });

// ------- Route --------------------------------------------------------------

export const Route = createFileRoute("/passport/$gtin")({
  loader: async ({ params }) => {
    const data = await getPublicProductByGtin({ data: { gtin: params.gtin } });
    if (!data.found) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData || !loaderData.found) {
      return { meta: [{ title: "Product not found — TAG" }, { name: "robots", content: "noindex" }] };
    }
    const p: any = loaderData.product;
    const pp: any = loaderData.passport;
    const title = `${p.name}${p.brand ? ` — ${p.brand}` : ""}`;
    const desc = pp?.product_summary ?? pp?.short_description ?? p.description ?? `${p.name} on TAG.`;
    const img = pp?.hero_image ?? p.hero_image ?? p.image_url ?? null;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "product" },
        ...(img
          ? [
              { property: "og:image", content: img },
              { name: "twitter:image", content: img },
            ]
          : []),
        { name: "twitter:card", content: img ? "summary_large_image" : "summary" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl p-12 text-center">
      <h1 className="text-2xl font-semibold">Product not found</h1>
      <p className="mt-2 text-muted-foreground">
        This barcode isn't registered on TAG yet.
      </p>
      <Link to="/" className="mt-6 inline-block text-sm underline">Home</Link>
    </div>
  ),
  errorComponent: () => (
    <div className="mx-auto max-w-xl p-12 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">Please try again shortly.</p>
    </div>
  ),
  component: PublicProduct,
});

function PublicProduct() {
  const { product, passport, gtin } = Route.useLoaderData() as any;
  const gallery: any[] = (passport?.image_gallery?.length ? passport.image_gallery : passport?.images) ?? [];
  const onSale =
    product.sale_price_cents != null && product.sale_price_cents < product.price_cents;
  const price = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: product.currency ?? "ZAR",
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>TAG · Digital Product Passport</span>
          <span className="font-mono">GTIN {gtin}</span>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card">
          <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
            <ProductImage product={product} variant="hero" alt={product.name} />
          </div>
          <div className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
                {(passport?.brand || product.brand) && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {passport?.brand ?? product.brand}
                    {passport?.manufacturer && passport.manufacturer !== (passport?.brand ?? product.brand)
                      ? ` · ${passport.manufacturer}`
                      : ""}
                    {passport?.country_of_origin ? ` · Made in ${passport.country_of_origin}` : ""}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className={`text-2xl font-semibold ${onSale ? "text-emerald-600" : ""}`}>
                  {price.format((onSale ? product.sale_price_cents : product.price_cents) / 100)}
                </p>
                {onSale && (
                  <p className="text-sm text-muted-foreground line-through">
                    {price.format(product.price_cents / 100)}
                  </p>
                )}
                {product.on_promotion && (
                  <span className="mt-2 inline-block rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                    ★ {product.promotion_label ?? "On promotion"}
                  </span>
                )}
                {typeof product.stock_qty === "number" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {product.stock_qty > 0 ? `${product.stock_qty} left in stock` : "Out of stock"}
                  </p>
                )}
              </div>
            </div>
            {passport?.product_summary && (
              <p className="mt-4 text-base leading-relaxed">{passport.product_summary}</p>
            )}
            {!passport?.product_summary && product.description && (
              <p className="mt-4 text-base leading-relaxed">{product.description}</p>
            )}

            <NotifyBar gtin={gtin} productName={product.name} />
          </div>
        </div>

        {gallery.length > 1 && (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {gallery.slice(0, 8).map((img: any, i: number) => (
              <div key={i} className="aspect-square overflow-hidden rounded-lg border bg-muted">
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        <Section title="About" show={!!passport?.marketing_description}>
          <p className="whitespace-pre-line leading-relaxed">{passport?.marketing_description}</p>
        </Section>

        <Section title="Ingredients" show={(passport?.ingredients ?? []).length > 0}>
          <p>{(passport?.ingredients ?? []).join(", ")}</p>
        </Section>

        <Section title="Nutrition" show={Object.keys(passport?.nutrition ?? {}).length > 0}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            {Object.entries(passport?.nutrition ?? {}).map(([k, v]) =>
              v == null ? null : (
                <div key={k} className="flex justify-between border-b py-1">
                  <dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                  <dd className="font-medium">{String(v)}</dd>
                </div>
              ),
            )}
          </dl>
        </Section>

        <Section title="Allergens" show={(passport?.allergens ?? []).length > 0}>
          <div className="flex flex-wrap gap-2">
            {(passport?.allergens ?? []).map((a: string) => (
              <span key={a} className="rounded-full border px-3 py-1 text-xs">{a}</span>
            ))}
          </div>
        </Section>

        <Section title="Storage" show={!!passport?.storage_instructions}>
          <p>{passport?.storage_instructions}</p>
        </Section>

        <Section title="Preparation" show={!!passport?.preparation_instructions}>
          <p>{passport?.preparation_instructions}</p>
        </Section>

        <Section
          title="Sustainability"
          show={Object.keys(passport?.sustainability ?? {}).length > 0 || Object.keys(passport?.recycling ?? {}).length > 0}
        >
          <ul className="space-y-1 text-sm">
            {passport?.sustainability?.packaging && <li>Packaging: {passport.sustainability.packaging}</li>}
            {passport?.sustainability?.recyclable != null && (
              <li>Recyclable: {passport.sustainability.recyclable ? "Yes" : "No"}</li>
            )}
            {(passport?.sustainability?.certifications ?? []).length > 0 && (
              <li>Certifications: {passport.sustainability.certifications.join(", ")}</li>
            )}
            {passport?.sustainability?.notes && <li>{passport.sustainability.notes}</li>}
            {passport?.recycling?.instructions && <li>Recycling: {passport.recycling.instructions}</li>}
          </ul>
        </Section>

        <Section
          title="Warranty"
          show={!!(passport?.warranty?.duration_months || passport?.warranty?.terms)}
        >
          <p className="text-sm">
            {passport?.warranty?.duration_months
              ? `${passport.warranty.duration_months} months. `
              : ""}
            {passport?.warranty?.terms ?? ""}
          </p>
        </Section>

        <Section title="Questions shoppers ask" show={(passport?.consumer_faqs ?? []).length > 0}>
          <div className="space-y-3">
            {(passport?.consumer_faqs ?? []).map((f: any, i: number) => (
              <div key={i} className="rounded-lg border p-3">
                <p className="font-medium">{f.question}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.answer}</p>
              </div>
            ))}
          </div>
        </Section>

        <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
          <p>
            Scanned via <span className="font-semibold">TAG</span> · GS1 Digital Link · AI (01) {gtin}
          </p>
        </div>
      </div>
    </div>
  );
}

function NotifyBar({ gtin, productName }: { gtin: string; productName: string }) {
  const [phone, setPhone] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneOk = phone && isValidPhoneNumber(phone);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneOk || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/scan/barcode-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gtin, whatsapp: phone }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Something went wrong");
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 flex items-center gap-3 rounded-2xl border bg-card p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600/12 text-emerald-600">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <p className="text-sm">
          You're all set — {productName} will WhatsApp you if anything changes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border bg-card p-4">
      <p className="text-sm font-medium">Notify me on WhatsApp</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        One WhatsApp if this drops in price, restocks, or is almost gone.
      </p>
      <div className="mt-3 rounded-md border border-input bg-background px-3 py-2 [&_.PhoneInput]:flex [&_.PhoneInputCountry]:mr-2 [&_input]:bg-transparent [&_input]:outline-none [&_input]:flex-1 [&_input]:text-sm">
        <PhoneInput
          defaultCountry="ZA"
          international
          placeholder="Enter phone number"
          value={phone}
          onChange={setPhone}
        />
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={!phoneOk || submitting} className="mt-3 w-full h-11">
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <MessageCircle className="mr-2 h-4 w-4" />
            Notify me on WhatsApp
          </>
        )}
      </Button>
      <p className="mt-2 flex items-center gap-1.5 justify-center text-[11px] text-muted-foreground">
        <ShieldCheck className="h-3 w-3" /> Secure · No spam · Unsubscribe anytime
      </p>
    </form>
  );
}

function Section({ title, show, children }: { title: string; show: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <section className="mt-6 rounded-2xl border bg-card p-6">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="text-sm">{children}</div>
    </section>
  );
}
