## Two-part plan

### PART A — Global rebrand (Fusion-inspired forest + cream, Sora/Manrope)

Apply the reference palette and typography globally: auth pages, dashboard, all authenticated routes inherit via design tokens.

**Palette**
- Cream `#F5F1EA` — page base
- Deep forest `#1F3B2D` — primary / dark feature bands
- Ink `#0E0E0E` — headings, CTAs
- Muted sage `#7A8A80` — secondary text on dark
- White `#FFFFFF` — elevated card surfaces
- Accent peach `#F4C9A8` — small pills
- Success emerald `#10B981` — kept for status states

**Typography**
- Headings: **Sora** (600–800), tight tracking
- Body: **Manrope** (400–600)
- Install `@fontsource-variable/sora` + `@fontsource-variable/manrope`, import in `src/styles.css`, register under `@theme` as `--font-display` and `--font-sans`

**Files**
1. `src/styles.css` — replace `:root` + `.dark` color tokens (OKLCH), add fonts, keep shadcn token mapping so all components inherit automatically
2. `src/components/auth-shell.tsx` — cream page background, forest accents
3. Spot-check dashboard KPI cards, sidebar, badges — all shadcn-based, will inherit

**What stays**: layouts, routes, animations, component structure, logo, dark mode.

---

### PART B — Password reset via custom edge function (copy Holarc Health's method)

Replace the fragile Supabase "Send Email hook" approach with Holarc's proven pattern: a custom edge function that mints the recovery link server-side and sends a branded email via the existing Resend + `mypenguin.co.za` setup. **No Supabase dashboard config needed.**

**How it works**
1. `/forgot-password` calls a new edge function `send-password-reset` (instead of `supabase.auth.resetPasswordForEmail`)
2. Edge function uses `SUPABASE_SERVICE_ROLE_KEY` to call `admin.auth.admin.generateLink({ type: 'recovery', email, options: { redirectTo } })` — this mints a valid recovery link without triggering Supabase's built-in email
3. Edge function sends a MyPenguin-branded HTML email containing that link via the Resend connector gateway (reuses `src/lib/email.server.ts` pattern)
4. Recipient clicks the link → lands on existing `/reset-password` → sets new password (unchanged)
5. Always returns 200 to avoid leaking which emails are registered

**Files to create/change**
1. **New** `supabase/functions/send-password-reset/index.ts` — mirror Holarc's file: Zod validation, service-role `generateLink`, MyPenguin-branded HTML (navy `#031C4D` + emerald `#10B981` from existing brand), sent via Resend gateway using `LOVABLE_API_KEY` + `RESEND_API_KEY` secrets already in place
2. **Update** `supabase/config.toml` — add `[functions.send-password-reset]` with `verify_jwt = false` (public endpoint)
3. **Update** `src/routes/forgot-password.tsx` — swap `supabase.auth.resetPasswordForEmail(...)` for a `fetch` to the new function's URL. Keep existing UX (success screen, error handling).
4. **Remove** the now-obsolete `supabase/functions/send-auth-email/` — the hook-based approach that never got enabled

**Why this works**
- Uses secrets already configured (`RESEND_API_KEY`, `LOVABLE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
- Uses the verified `mypenguin.co.za` sender domain already set up in Resend
- No Supabase dashboard access required
- No Lovable Emails domain delegation / NS records needed
- Signup/magic-link/invite emails continue using Supabase defaults (out of scope for this plan)

**Verification**
- Trigger a reset from `/forgot-password` in the deployed app
- Check `send-password-reset` edge function logs: generateLink succeeded, Resend returned 200
- Confirm branded email arrives from `noreply@mypenguin.co.za`
- Click the link → land on `/reset-password` → complete password update → redirected to `/dashboard`
