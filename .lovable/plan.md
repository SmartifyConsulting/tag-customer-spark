# Tag — Application Structure Plan

Scaffold only. No business logic.

## 1. Backend (Lovable Cloud / Supabase)

- Enable Lovable Cloud.
- Upload logo as Lovable Asset (`src/assets/tag-logo.png.asset.json`).
- Auth: email/password + Google (default per platform guidance). Auto-confirm on. Forgot/reset password flows.
- Tables (structure only, no app logic on top):
  - `profiles (id uuid pk → auth.users, full_name, avatar_url, created_at)` — auto-created via trigger on signup.
  - `app_role` enum: `super_admin`, `retail_admin`, `store_manager`, `sales_assistant`.
  - `user_roles (id, user_id, role, unique(user_id, role))`.
  - `has_role(_user_id, _role)` security-definer function.
- RLS + GRANTs on both tables (users read/update own profile; users read own roles).

## 2. Design System (`src/styles.css`)

Tokens in oklch, light + dark:
- `--primary` Navy `#031C4D`
- `--success` Emerald
- `--warning` Orange (alerts)
- `--background` white / dark navy
- `--muted` light grey surfaces
- Rounded radius `1rem`, soft shadows, generous spacing.
- Font: Inter via `<link>` in `__root.tsx` head (replaceable). Distinctive weight ramp.
- Stripe-meets-Notion: clean cards, subtle borders, restrained color, lots of whitespace.

## 3. Routing (TanStack Start, file-based)

Public:
- `/auth` — login + signup tabs, polished card layout, logo, Google button, password eye toggle, "Forgot password?" (tabIndex -1).
- `/forgot-password`
- `/reset-password`

Authenticated subtree under `_authenticated/` (integration-managed gate):
- `/dashboard`
- `/products`
- `/qr-tags`
- `/customers`
- `/notifications`
- `/analytics`
- `/stores`
- `/staff`
- `/settings`

Index `/` redirects to `/dashboard` (or `/auth`).

Each page = placeholder: page header, short description, empty-state card. Every route sets its own `head()` meta + errorComponent/notFoundComponent.

## 4. App Shell

`_authenticated/route.tsx` wraps `<Outlet />` in:
- Shadcn `SidebarProvider` + collapsible `AppSidebar` with Tag logo, 9 nav items (lucide icons), active-route highlight via `useRouterState`.
- Top header: `SidebarTrigger`, page title slot, dark-mode toggle, user profile dropdown (avatar, name, role badge, Profile, Settings, Sign out).
- Fully responsive: sidebar collapses to icon strip on desktop, off-canvas on mobile.

## 5. Auth & Roles

- `useAuth` hook: session via `onAuthStateChange` + `getUser`, exposes `user`, `profile`, `roles[]`, `hasRole()`, `signOut()` (with query cancel/clear → `/auth` replace).
- Sign-out hygiene per platform rules.
- Role gating helper component `<RequireRole roles={[...]}>` for future use (not enforced on placeholder pages yet, but wired).
- Profile dropdown shows highest role.

## 6. Dark Mode

- `next-themes`-style provider using `.dark` class on `<html>`.
- Toggle in header (Sun/Moon).
- Persisted to localStorage; respects system default.

## 7. Out of Scope (this pass)

- QR generation, WhatsApp integration, product CRUD, notification dispatch, analytics charts, multi-store data, staff invites.
- Role assignment UI (roles seeded manually for now; super_admin assignment instructions in Settings placeholder).

## Technical Notes

- TanStack Start + TanStack Query already wired.
- Use `@/integrations/supabase/client` in components; `requireSupabaseAuth` for any future protected server fns.
- Google OAuth via `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`; call `supabase--configure_social_auth` when implementing.
- All colors via semantic tokens — no hardcoded hex in components.
