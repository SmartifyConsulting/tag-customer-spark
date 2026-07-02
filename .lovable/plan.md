## 1. UI clean-ups

**Sidebar (`src/components/app-sidebar.tsx`)**
- Swap the navy `--sidebar` background for a "chic grey" palette: sidebar bg `oklch(0.97 0 0)` (light) / `oklch(0.22 0 0)` (dark), foreground near-black, mint accent kept for active state (mint pill + left bar).
- Replace the current icon logo with the hero wordmark `src/assets/tag-logo-hero.png`. Add a `variant="wordmark"` option on `TagLogo` that renders the wordmark, sized appropriately for the sidebar (expanded) and falls back to the icon when collapsed to preserve the icon rail.
- Adjust footer text colour to sit on the new grey.

**Auth page (`src/routes/auth.tsx`)**
- Remove the "Sign in / Create account" `TabsList` (that's the duplicate "Sign in" next to the submit button). Replace with a single sign-in form and a "New here? Create account" link that toggles to the sign-up form, or split into `/auth` (sign in) and `/auth/signup`. Chosen approach: keep one route, drop the tabs, render sign-in by default with a small "Create account" text button at the bottom that swaps the form in place.
- Apply the sign-up-and-authenticate skill rules: password visibility toggle (already via `PasswordInput`), Forgot Password link with `tabIndex={-1}`, tab order Email → Password → Submit, sign-up straight into the app (no email-confirm block), and `mapAuthError` helper for friendly error messages.

## 2. Backend: billing schema

New migration adds (mirrors Picnic, adapted to Tag's retailer-scoped model):

- `public.payment_purchases` — `id`, `retailer_id`, `user_id`, `provider` ('paypal'|'payfast'), `provider_order_id` unique per provider, `plan` (tag_tier), `billing_cycle` ('monthly'|'annual'), `amount_cents`, `currency`, `status` ('pending'|'completed'|'failed'|'cancelled'), `raw` jsonb, timestamps.
- Extend existing `public.subscriptions` (already present) with `provider`, `provider_subscription_id`, `billing_cycle`, `cancel_at_period_end`, `trial_ends_at`, `updated_by`.
- `public.billing_events` — audit trail of ITN / webhook / capture events (`retailer_id`, `provider`, `event_type`, `payload`, `signature_ok`, timestamps).
- Extend `retailers` with `billing_email`, `billing_country` (default 'ZA'), `vat_number`.
- Grants: `authenticated` gets own-retailer SELECT on `payment_purchases`, `subscriptions`, `billing_events`; `service_role` full access. RLS via existing `belongs_to_retailer` / `can_manage_retailer` helpers so only retail_admin can initiate checkout or view invoices; sales_assistant cannot.
- Function `public.apply_paid_tier(_retailer_id uuid, _tier tag_tier, _cycle text, _period_end timestamptz)` — security definer, upserts subscription row and updates `retailers.tier`.

## 3. Backend: payment server code (ported from Picnic)

- `src/lib/billing/payfast.server.ts` — env, `PAYFAST_PROCESS_URL`, `pfEncode`, `buildPfSignature` (MD5 of alphabetically-sorted fields + passphrase), ITN validate URL.
- `src/lib/billing/paypal.server.ts` — env, `PAYPAL_BASE`, `getPayPalToken` (client credentials OAuth).
- `src/lib/billing/pricing.ts` — Tag plans: Starter R0, Pro R499/mo (R4990/yr), Enterprise "contact"; ZAR + USD conversions for PayPal.
- `src/lib/billing/grant.server.ts` — `grantTier(retailerId, plan, cycle)` calls the SQL function above, writes audit row.
- `src/lib/billing.functions.ts` — server fns:
  - `createPayfastCheckout({ plan, cycle })` → inserts pending purchase, returns `{ redirect_url, m_payment_id }`.
  - `createPaypalOrder({ plan, cycle })` → creates PayPal order, returns `{ order_id, approve_url }`.
  - `capturePaypalOrder({ order_id })` → captures + grants tier + marks purchase completed.
  - `listMyPurchases()`, `getMySubscription()`, `cancelSubscription()`.
  - `adminListSubscriptions()` / `adminSetTier()` — gated by `super_admin` / `retail_admin`.
- Public server routes (bypass auth, verify signatures inside):
  - `src/routes/api/public/webhooks/payfast-itn.ts` — verify with PayFast validate endpoint + signature, mark purchase completed, grant tier.
  - `src/routes/api/public/webhooks/paypal.ts` — verify PayPal webhook signature, handle `CHECKOUT.ORDER.APPROVED` / `PAYMENT.CAPTURE.COMPLETED` / `BILLING.SUBSCRIPTION.CANCELLED`.
  - `src/routes/api/public/billing/return.ts` and `cancel.ts` — post-checkout landing.

## 4. Secrets

Requested via `add_secret` (after plan approval):
- `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_ENV` (default `sandbox`).
- `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_ENV` (default `sandbox`).

User will paste these into the secret form once the plan is approved. Sandbox URLs are pre-wired; going live is a one-env-var flip.

## 5. UI: Billing + Plan admin

- **User Billing** at `/settings` → new "Billing" tab (retail_admin only):
  - Current plan card (tier badge, renewal date, cycle toggle).
  - Change plan panel: three plan cards (Starter / Pro / Enterprise) with monthly/annual toggle and two checkout buttons per paid plan: **Pay with PayFast** (ZAR redirect) and **Pay with PayPal** (approve-in-popup then capture).
  - Invoices/purchases table sourced from `payment_purchases`.
  - Cancel subscription action.
- **Plan admin** at `/settings` → new "Plan admin" tab (super_admin only):
  - Table of all retailers with tier, provider, status, MRR, last payment.
  - Force-set tier action, view billing events per retailer.
- Existing `/upgrade` upsell page gets working "Upgrade" buttons that deep-link to `/settings?tab=billing&plan=pro`.

## 6. Confirming "stock removed"

Stock UI was trimmed in earlier turns (dashboard low-stock card, product form inventory fields, low-stock filter, low_stock notification template). Confirmed remaining references:
- `src/components/dashboard/low-stock-card.tsx` still exists on disk — remove file.
- `low_stock` trigger option remains in the notification composer and DB `watchlists.trigger` enum. Per your MVP scope this stays (low-stock alerts to shoppers are a revenue-recovery mechanic, not a stock-management screen), but the retailer-facing "manage stock" surfaces are gone. Flag if you want the trigger removed too.

## 7. Verification

- `bun run build` clean.
- Playwright: sign in → open `/settings` → Billing tab → start PayFast checkout (asserts redirect URL contains `sandbox.payfast.co.za/eng/process` and a signed `signature=`) and PayPal order (asserts `approve_url` from PayPal sandbox).
- Fire a synthetic PayFast ITN at the public webhook with a signed body, assert the purchase flips to `completed` and `retailers.tier` becomes `pro`.
- Screenshot the restyled sidebar (chic grey + wordmark) and the de-duplicated auth page.

## Files touched

New: migration; `src/lib/billing/{payfast,paypal,grant,pricing}.server.ts`; `src/lib/billing.functions.ts`; `src/routes/api/public/webhooks/{payfast-itn,paypal}.ts`; `src/routes/api/public/billing/{return,cancel}.ts`; `src/components/settings/{billing-tab,plan-admin-tab,plan-cards}.tsx`; `src/lib/auth-errors.ts`.
Edited: `src/components/app-sidebar.tsx`, `src/components/tag-logo.tsx`, `src/styles.css` (sidebar tokens), `src/routes/auth.tsx`, `src/routes/_authenticated/settings.tsx`, `src/routes/_authenticated/upgrade.tsx`.
Deleted: `src/components/dashboard/low-stock-card.tsx`.