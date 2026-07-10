// Legacy /p/{dppId} URLs — 301 to the canonical /products/{gtin} page.
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const lookupGtin = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ dpp_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("products")
      .select("gtin")
      .eq("digital_product_passport_id", data.dpp_id)
      .maybeSingle();
    return { gtin: (p as any)?.gtin ?? null };
  });

export const Route = createFileRoute("/p/$dppId")({
  loader: async ({ params }) => {
    const { gtin } = await lookupGtin({ data: { dpp_id: params.dppId } });
    if (typeof window === "undefined") {
      const { redirect } = await import("@tanstack/react-router");
      throw redirect({ to: gtin ? "/products/$gtin" : "/", params: { gtin: gtin ?? "" } });
    }
    if (gtin) window.location.replace(`/products/${gtin}`);
    return { gtin };
  },
  component: () => (
    <div className="mx-auto max-w-xl p-8 text-center">
      <p className="text-sm text-muted-foreground">Redirecting…</p>
    </div>
  ),
});
