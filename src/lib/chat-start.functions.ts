import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Public info the "Opening WhatsApp" page needs: the product being scanned and
// TAG's WhatsApp business number (the same sender the confirmation goes out
// from — it is public by nature, shoppers message it).
export const getChatStartInfo = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) =>
    z
      .object({
        gtin: z.string().max(20).optional(),
        shortCode: z.string().max(64).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const numberDigits = (process.env.INFOBIP_WHATSAPP_SENDER ?? "").replace(/[^\d]/g, "");
    if (!numberDigits) return null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.shortCode) {
      const { data: tag } = await supabaseAdmin
        .from("qr_tags")
        .select("is_active, product:products(name), retailer:retailers(name, logo_url)")
        .eq("short_code", data.shortCode)
        .maybeSingle();
      if (!tag || !(tag as any).is_active) return null;
      return {
        numberDigits,
        target: { kind: "T" as const, value: data.shortCode },
        productName: ((tag as any).product?.name as string | undefined) ?? "this product",
        retailerName: ((tag as any).retailer?.name as string | undefined) ?? null,
        retailerLogo: ((tag as any).retailer?.logo_url as string | undefined) ?? null,
      };
    }

    if (data.gtin) {
      const { validGtin14, findActiveProductByGtin } = await import("@/lib/gtin-lookup.server");
      const gtin14 = validGtin14(data.gtin);
      if (!gtin14) return null;
      const product = await findActiveProductByGtin(supabaseAdmin, gtin14, "name, retailer_id");
      if (!product) return null;
      const { data: retailer } = await supabaseAdmin
        .from("retailers")
        .select("name, logo_url")
        .eq("id", product.retailer_id)
        .maybeSingle();
      return {
        numberDigits,
        target: { kind: "G" as const, value: gtin14 },
        productName: (product.name as string | undefined) ?? "this product",
        retailerName: ((retailer as any)?.name as string | undefined) ?? null,
        retailerLogo: ((retailer as any)?.logo_url as string | undefined) ?? null,
      };
    }

    return null;
  });
