// Shared by ownership.functions.ts and system-settings.functions.ts. Kept in
// its own module so neither has to import the other (avoids a circular
// import between the two server-fn files).

// Staff resolve their retailer via user_roles. A wallet (customer) account
// has no staff role at all, so it falls back to the same WhatsApp-number
// link Tagged uses: profiles.whatsapp_e164 -> customers.whatsapp_e164 ->
// customers.retailer_id. This is a stopgap, not a real multi-retailer
// consumer identity.
export async function resolveRetailerId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("retailer_id")
    .eq("user_id", userId)
    .not("retailer_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (data?.retailer_id) return data.retailer_id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("whatsapp_e164")
    .eq("id", userId)
    .maybeSingle();
  if (!profile?.whatsapp_e164) return null;

  const { data: customer } = await supabase
    .from("customers")
    .select("retailer_id")
    .eq("whatsapp_e164", profile.whatsapp_e164)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return customer?.retailer_id ?? null;
}

// Shoppers have no retailer link via resolveRetailerId (no staff role, no
// whatsapp-matched customer with a retailer). Until real per-user tag
// linkage exists, fall back to the single demo consumer tag so a shopper
// account can see purchases/receipts/returns instead of a blank page.
export async function resolveOwnershipContext(
  supabase: any,
  userId: string,
): Promise<{ retailerId: string | null; tagRef: string | null }> {
  const retailerId = await resolveRetailerId(supabase, userId);
  if (retailerId) return { retailerId, tagRef: null };

  const { data: tag } = await supabase
    .from("consumer_tag_ids")
    .select("id, retailer_id")
    .limit(1)
    .maybeSingle();
  if (!tag?.id) return { retailerId: null, tagRef: null };
  return { retailerId: tag.retailer_id, tagRef: tag.id };
}
