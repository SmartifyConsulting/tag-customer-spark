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
    // the auth user (see auth.tsx) — needed since this may run well after
    // signUp, once the user confirms their email and actually gets a session.
    const { data: rows, error } = await supabase.rpc("complete_signup", {
      p_name: data.name ?? null,
      p_billing_country: data.billingCountry ?? null,
      p_currency: data.currency ?? null,
      p_country_name: data.countryName ?? null,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    // `isNew` tells the caller whether this call provisioned a brand-new
    // retailer (the owner's first-ever signup) — not just any first
    // attachment, so a staff member accepting an invite doesn't also get
    // routed into TAG Setup. Used to route only that case into the wizard.
    return { retailerId: row?.retailer_id, isNew: !!row?.provisioned_new_retailer };
  });
