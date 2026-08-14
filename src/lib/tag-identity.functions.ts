import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// A user's own personal TAG identity, created automatically at signup (see
// handle_new_user() in the DB). This is the only piece of the old Ownership
// module that survives — it backs the "My Tag" screen and the profile card.
export const getMyShopperTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context as any;
    const { data } = await supabase
      .from("consumer_tag_ids")
      .select("tag_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data?.tag_id) return null;
    return { tagId: data.tag_id as string, email: (claims?.email as string) ?? null };
  });
