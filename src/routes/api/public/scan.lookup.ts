import { createFileRoute } from "@tanstack/react-router";

// Public product card lookup for the multi-scan list. Returns only public
// catalogue fields (name, price, image) — never customer data.
export const Route = createFileRoute("/api/public/scan/lookup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const raw = new URL(request.url).searchParams.get("gtin") ?? "";
        const digits = raw.replace(/\D/g, "");
        if (![8, 12, 13, 14].includes(digits.length)) {
          return Response.json({ ok: false, error: "Invalid barcode" }, { status: 400 });
        }
        const gtin14 = digits.padStart(14, "0");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { findActiveProductByGtin } = await import("@/lib/gtin-lookup.server");
        const p: any = await findActiveProductByGtin(
          supabaseAdmin,
          gtin14,
          "id, name, price_cents, sale_price_cents, image_url, hero_image, thumbnail_url",
        );
        if (!p) return Response.json({ ok: false, error: "Product not found" }, { status: 404 });
        return Response.json(
          {
            ok: true,
            product: {
              gtin: digits,
              name: p.name ?? "Product",
              priceCents: p.sale_price_cents ?? p.price_cents ?? null,
              image: p.thumbnail_url ?? p.hero_image ?? p.image_url ?? null,
            },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
