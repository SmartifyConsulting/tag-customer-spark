import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Called once, right after `supabase.auth.signUp`, to attach the new user to
// a retailer — either a pending staff invite matched by email, or a
// brand-new retailer they own. See migration 20260713090000 for the actual
// logic (a SECURITY DEFINER RPC, since regular `authenticated` clients can't
// INSERT into `retailers` directly).
export const completeSignup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(120).optional(),
        billingCountry: z.string().length(2).optional(),
        currency: z.string().length(3).optional(),
        countryName: z.string().trim().min(1).max(80).optional(),
        branchName: z.string().trim().min(1).max(120).optional(),
        province: z.string().trim().min(1).max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // complete_signup is SECURITY DEFINER and no longer callable by
    // `authenticated`. Run it through the admin client and pass the caller's
    // id explicitly (verified by requireSupabaseAuth middleware).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meta = ((context as any).claims?.user_metadata ?? {}) as Record<string, unknown>;
    const { data: rows, error } = await (supabaseAdmin as any).rpc("complete_signup", {
      p_name: data.name ?? (meta.company_name as string | undefined) ?? null,
      p_billing_country:
        data.billingCountry ?? (meta.billing_country as string | undefined) ?? null,
      p_currency: data.currency ?? (meta.currency as string | undefined) ?? null,
      p_country_name: data.countryName ?? (meta.country_name as string | undefined) ?? null,
      p_user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return { retailerId: row?.retailer_id, isNew: !!row?.provisioned_new_retailer };
  });

