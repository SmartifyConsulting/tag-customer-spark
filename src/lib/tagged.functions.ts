import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// "Tagged" products — items a shopper scanned and asked to be notified
// about (customer_interests, status "active") but hasn't bought yet. This
// is distinct from Purchases: interest is captured by phone number at scan
// time (the barcode-reader "Follow Me" flow), so it's linked here by
// matching the signed-in user's own WhatsApp number, stored on their
// profile once they add it.

export const listMyTaggedProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;

    const { data: profile } = await supabase
      .from("profiles")
      .select("whatsapp_e164")
      .eq("id", userId)
      .maybeSingle();
    const phone = profile?.whatsapp_e164 as string | undefined;
    if (!phone) return { items: [], linked: false };

    const { data: customers } = await supabase
      .from("customers")
      .select("id")
      .eq("whatsapp_e164", phone);
    const customerIds = ((customers ?? []) as any[]).map((c) => c.id);
    if (customerIds.length === 0) return { items: [], linked: true };

    const { data } = await supabase
      .from("customer_interests")
      .select(
        "id, created_at, product:products(id, name, brand, image_url, hero_image, price_cents, sale_price_cents, stock_qty), retailer:retailers(name)",
      )
      .in("customer_id", customerIds)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    return { items: data ?? [], linked: true };
  });
