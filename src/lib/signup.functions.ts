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
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    // Any field left unset falls back to the signup-time metadata stored on
    // the auth user (see auth.tsx's `options.data` on signUp) — needed since
    // this often runs well after signUp, from AuthProvider's generic safety
    // net (no form data available there) rather than the signup form itself.
    const meta = ((context as any).claims?.user_metadata ?? {}) as Record<string, unknown>;
    const { data: rows, error } = await supabase.rpc("complete_signup", {
      p_name: data.name ?? (meta.company_name as string | undefined) ?? null,
      p_billing_country:
        data.billingCountry ?? (meta.billing_country as string | undefined) ?? null,
      p_currency: data.currency ?? (meta.currency as string | undefined) ?? null,
      p_country_name: data.countryName ?? (meta.country_name as string | undefined) ?? null,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    // `isNew` tells the caller whether this call provisioned a brand-new
    // retailer (the owner's first-ever signup) — not just any first
    // attachment, so a staff member accepting an invite doesn't also get
    // routed into TAG Setup. Used to route only that case into the wizard.
    return { retailerId: row?.retailer_id, isNew: !!row?.provisioned_new_retailer };
  });
