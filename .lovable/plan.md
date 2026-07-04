# Forgot Password via Resend (mypenguin.co.za)

You already have the Resend connector linked (`RESEND_API_KEY` present) and `mypenguin.co.za` as your custom domain. We'll wire a Supabase Auth email hook that sends the password-reset email through Resend from `noreply@mypenguin.co.za`, so branding and deliverability come from your own domain instead of the default Supabase sender.

## What gets built

1. **Edge function `send-auth-email`** (`supabase/functions/send-auth-email/index.ts`)
   - Public endpoint (verify_jwt = false), registered in `supabase/config.toml`.
   - Verifies the `SEND_EMAIL_HOOK_SECRET` (standard Supabase webhook signature) so only Supabase Auth can call it.
   - On `email_action_type === "recovery"`, renders a branded HTML email (Tag/Penguin colors, logo, CTA button) containing the Supabase-provided confirmation URL and sends it via the Resend connector gateway:
     - `POST https://connector-gateway.lovable.dev/resend/emails`
     - Headers: `Authorization: Bearer ${LOVABLE_API_KEY}`, `X-Connection-Api-Key: ${RESEND_API_KEY}`
     - From: `MyPenguin <noreply@mypenguin.co.za>`
   - Falls through for other action types (signup, magiclink, etc.) so existing flows aren't affected — same template, different subject/heading.

2. **Secret**
   - Add `SEND_EMAIL_HOOK_SECRET` (generated) via the secrets tool. Instruct you to paste the same value into Cloud → Auth → Email hooks so Supabase signs its calls with it.

3. **Frontend**
   - `src/routes/forgot-password.tsx` already calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '${origin}/reset-password' })` — no change needed.
   - `src/routes/reset-password.tsx` remains unchanged.

## Prerequisites you handle once (one-time, in Cloud UI)

- Verify `mypenguin.co.za` in Resend (add the SPF/DKIM DNS records Resend shows).
- In Cloud → Auth → Hooks → "Send email hook": enable it, point it at the deployed `send-auth-email` function URL, paste the `SEND_EMAIL_HOOK_SECRET`.

I'll surface the exact function URL and hook-setup steps after deploying.

## Out of scope

- No changes to Products / QR Tags / stock / sidebar.
- Not switching to Lovable Emails infra (you explicitly chose Resend).
- Not touching the biolog / holarchealth domains.
