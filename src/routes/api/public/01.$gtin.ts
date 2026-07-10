import { createFileRoute } from "@tanstack/react-router";

// GS1 Digital Link resolver for AI (01) GTIN. Kept for backwards compatibility
// with QR codes generated before we moved the canonical URL to /products/{gtin}.
// - JSON/linkset requests get GS1 Resolver-conformant metadata (dpp_url points
//   to the canonical /products/{gtin} page).
// - Browser scans are 301-redirected to /products/{gtin} so old printed QRs
//   continue to work forever.

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

export const Route = createFileRoute("/api/public/01/$gtin")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const gtin14 = validGtin14(params.gtin);
        if (!gtin14) return new Response("Invalid GTIN", { status: 400 });

        const origin = new URL(request.url).origin;
        const dppUrl = `${origin}/passport/${gtin14}`;
        const accept = request.headers.get("accept") ?? "";
        const wantsJson =
          accept.includes("application/json") || accept.includes("application/linkset+json");

        if (wantsJson) {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: product } = await supabaseAdmin
            .from("products")
            .select("name, brand")
            .eq("gtin", gtin14)
            .maybeSingle();
          return Response.json({
            gtin: gtin14,
            found: !!product,
            product: product
              ? { name: (product as any).name, brand: (product as any).brand ?? null }
              : null,
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
          status: 301,
          headers: {
            Location: dppUrl,
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
