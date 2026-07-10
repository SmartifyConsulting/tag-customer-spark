import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const getPublicPassport = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ dpp_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: p } = await supabase
      .from("product_passports")
      .select(
        "dpp_id, gtin, brand, manufacturer, country_of_origin, category_path, short_description, marketing_description, product_summary, consumer_faqs, ingredients, nutrition, allergens, dimensions, materials, warranty, sustainability, images, enriched_at",
      )
      .eq("dpp_id", data.dpp_id)
      .in("enrichment_status", ["enriched", "manual"])
      .maybeSingle();

    if (!p) return null;

    const { data: prod } = await supabase
      .from("products")
      .select("name, retailer:retailers(name)")
      .eq("digital_product_passport_id", data.dpp_id)
      .maybeSingle();

    return {
      passport: p,
      product: prod
        ? { name: prod.name, retailer_name: (prod.retailer as any)?.name ?? null }
        : null,
    };
  });

export const Route = createFileRoute("/p/$dppId")({
  loader: async ({ params }) => {
    const data = await getPublicPassport({ data: { dpp_id: params.dppId } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    const name = loaderData?.product?.name ?? "Digital Product Passport";
    const desc =
      loaderData?.passport?.product_summary ??
      loaderData?.passport?.short_description ??
      "Digital Product Passport powered by TAG.";
    const img = (loaderData?.passport?.images as any[])?.[0]?.url;
    return {
      meta: [
        { title: `${name} — Digital Product Passport` },
        { name: "description", content: desc },
        { property: "og:title", content: name },
        { property: "og:description", content: desc },
        { property: "og:type", content: "product" },
        ...(img ? [{ property: "og:image", content: img }, { name: "twitter:image", content: img }] : []),
        { name: "twitter:card", content: img ? "summary_large_image" : "summary" },
      ],
    };
  },
  errorComponent: () => (
    <div className="mx-auto max-w-xl p-8 text-center">
      <h1 className="text-2xl font-semibold">Passport unavailable</h1>
      <p className="mt-2 text-muted-foreground">Please try again shortly.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl p-8 text-center">
      <h1 className="text-2xl font-semibold">No passport found</h1>
      <p className="mt-2 text-muted-foreground">
        This product has not been registered on TAG yet.
      </p>
    </div>
  ),
  component: PassportPage,
});

function PassportPage() {
  const { passport, product } = Route.useLoaderData() as any;
  const heroImg = (passport.images ?? [])[0]?.url;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>TAG · Digital Product Passport</span>
          {passport.gtin && <span className="font-mono">GTIN {passport.gtin}</span>}
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card">
          {heroImg && (
            <img
              src={heroImg}
              alt={product?.name ?? "Product"}
              className="h-64 w-full object-cover"
            />
          )}
          <div className="p-6">
            <h1 className="text-3xl font-bold tracking-tight">{product?.name}</h1>
            {passport.brand && (
              <p className="mt-1 text-sm text-muted-foreground">
                {passport.brand}
                {passport.manufacturer && passport.manufacturer !== passport.brand
                  ? ` · ${passport.manufacturer}`
                  : ""}
                {passport.country_of_origin ? ` · Made in ${passport.country_of_origin}` : ""}
              </p>
            )}
            {passport.product_summary && (
              <p className="mt-4 text-base leading-relaxed">{passport.product_summary}</p>
            )}
          </div>
        </div>

        <Section title="About" show={!!passport.marketing_description}>
          <p className="whitespace-pre-line leading-relaxed">{passport.marketing_description}</p>
        </Section>

        <Section title="Ingredients" show={(passport.ingredients ?? []).length > 0}>
          <p>{(passport.ingredients ?? []).join(", ")}</p>
        </Section>

        <Section title="Nutrition" show={Object.keys(passport.nutrition ?? {}).length > 0}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            {Object.entries(passport.nutrition ?? {}).map(([k, v]) =>
              v == null ? null : (
                <div key={k} className="flex justify-between border-b py-1">
                  <dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                  <dd className="font-medium">{String(v)}</dd>
                </div>
              ),
            )}
          </dl>
        </Section>

        <Section title="Allergens" show={(passport.allergens ?? []).length > 0}>
          <div className="flex flex-wrap gap-2">
            {(passport.allergens ?? []).map((a: string) => (
              <span key={a} className="rounded-full border px-3 py-1 text-xs">{a}</span>
            ))}
          </div>
        </Section>

        <Section title="Dimensions" show={Object.values(passport.dimensions ?? {}).some((v) => v != null)}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
            {Object.entries(passport.dimensions ?? {}).map(([k, v]) =>
              v == null ? null : (
                <div key={k} className="flex justify-between border-b py-1">
                  <dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                  <dd className="font-medium">{String(v)}</dd>
                </div>
              ),
            )}
          </dl>
        </Section>

        <Section title="Sustainability" show={Object.keys(passport.sustainability ?? {}).length > 0}>
          <ul className="space-y-1 text-sm">
            {passport.sustainability?.packaging && <li>Packaging: {passport.sustainability.packaging}</li>}
            {passport.sustainability?.recyclable != null && (
              <li>Recyclable: {passport.sustainability.recyclable ? "Yes" : "No"}</li>
            )}
            {(passport.sustainability?.certifications ?? []).length > 0 && (
              <li>Certifications: {passport.sustainability.certifications.join(", ")}</li>
            )}
            {passport.sustainability?.notes && <li>{passport.sustainability.notes}</li>}
          </ul>
        </Section>

        <Section
          title="Warranty"
          show={!!(passport.warranty?.duration_months || passport.warranty?.terms)}
        >
          <p className="text-sm">
            {passport.warranty?.duration_months
              ? `${passport.warranty.duration_months} months. `
              : ""}
            {passport.warranty?.terms ?? ""}
          </p>
        </Section>

        <Section title="Questions shoppers ask" show={(passport.consumer_faqs ?? []).length > 0}>
          <div className="space-y-3">
            {(passport.consumer_faqs ?? []).map((f: any, i: number) => (
              <div key={i} className="rounded-lg border p-3">
                <p className="font-medium">{f.question}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.answer}</p>
              </div>
            ))}
          </div>
        </Section>

        <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
          <p>
            Scanned via <span className="font-semibold">TAG</span> · GS1 Digital Link
            {passport.gtin ? ` · AI (01) ${passport.gtin}` : ""}
          </p>
          {product?.retailer_name && <p className="mt-1">Sold by {product.retailer_name}</p>}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  show,
  children,
}: {
  title: string;
  show: boolean;
  children: React.ReactNode;
}) {
  if (!show) return null;
  return (
    <section className="mt-6 rounded-xl border bg-card p-5">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
