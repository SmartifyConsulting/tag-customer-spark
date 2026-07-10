import { createFileRoute } from "@tanstack/react-router";

// GS1 Digital Link resolver for AI (01) GTIN.
// - POS scanners parse the URL and extract the GTIN from /01/{gtin} exactly
//   like a linear barcode scan.
// - JSON/linkset requests receive resolver metadata (GS1 Resolver conformant).
// - Everything else is redirected to the public Digital Product Passport.

function validGtin14(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (![8, 12, 13, 14].includes(digits.length)) return null;
  const g = digits.padStart(14, "0");
  // Mod-10 check digit
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    const d = Number(g[i]);
    sum += d * (i % 2 === 0 ? 3 : 1);
  }
  const check = (10 - (sum % 10)) % 10;
  if (check !== Number(g[13])) return null;
  return g;
}

export const Route = createFileRoute("/api/public/01/$gtin")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const gtin14 = validGtin14(params.gtin);
        if (!gtin14) {
          return new Response("Invalid GTIN", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: product } = await supabaseAdmin
          .from("products")
          .select("id, retailer_id, digital_product_passport_id, name, brand")
          .eq("gtin", gtin14)
          .maybeSingle();

        const accept = request.headers.get("accept") ?? "";
        const wantsJson =
          accept.includes("application/json") || accept.includes("application/linkset+json");

        const origin = new URL(request.url).origin;

        if (!product) {
          if (wantsJson) {
            return Response.json(
              { gtin: gtin14, found: false, message: "No product registered for this GTIN." },
              { status: 404 },
            );
          }
          // Fallback: send scanner to a friendly not-found page
          return new Response(null, {
            status: 302,
            headers: { Location: `${origin}/p/unknown?gtin=${gtin14}` },
          });
        }

        const dppUrl = `${origin}/p/${product.digital_product_passport_id}`;

        if (wantsJson) {
          return Response.json({
            gtin: gtin14,
            found: true,
            product: { name: product.name, brand: product.brand ?? null },
            linkset: [
              {
                anchor: `${origin}/api/public/01/${gtin14}`,
                "https://gs1.org/voc/pip": [{ href: dppUrl, title: "Digital Product Passport" }],
              },
            ],
            dpp_url: dppUrl,
          });
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: dppUrl,
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
