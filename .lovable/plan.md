
## Goal

Bring the Products list and QR Tags registry visually in line with the two attached mockups, and make Forgot Password actually deliver a working reset email through a Supabase-backed flow.

## 1. Products page revamp (`image-3.png`)

Target: `src/routes/_authenticated/products.index.tsx` + `src/components/products/products-table.tsx` + `products-toolbar.tsx`.

Changes:
- Header row: bold "Products" title, muted subtitle "Manage and track all your products.", right-side actions `+ Import` (outline) and `+ Add Product` (solid navy `#031C4D`).
- Toolbar: single rounded search input with left magnifier + two compact selects ("All Categories", "All Stores") aligned right. Drop the current busy toolbar chips.
- Table: white card, thin dividers, columns `Product | Category | Price | Interest Score | Status`.
  - Product cell: 40px rounded thumbnail + product name (SKU removed from primary line).
  - Interest Score rendered as a small circular progress ring (SVG) with the numeric value centered, in mint green.
  - Status as pill: "Active" mint-tinted, "Inactive" muted.
- Footer: "Showing 1 to 7 of 48 products" left, numbered pagination right (already have `products-pagination.tsx` — restyle to match).

No schema changes; interest score already exists.

## 2. QR Tags page revamp (`image-4.png`)

Target: `src/routes/_authenticated/qr-tags.tsx`.

Changes:
- Header: "QR Tags" + subtitle "Create, manage and download QR codes.", right side single solid `+ Generate QR` button (navy).
- Stat tiles: 3 tiles across — "Total QR Codes", "Scans This Month", "Unique Products" — flat white cards, large tabular number, small uppercase label. Remove the current icon puck styling to match sample.
- Registry list: convert current grid rows into a clean list card with rows of `thumb | name + #TAG-000xxx | scans | download icon | overflow`.
- Filters: search + "All Stores" + "All Status" selects on one row above the list.
- Bottom link "View all QR codes" centered.
- Remove the mock phone preview from scope (sample shows it, but it's illustrative — skip unless requested).

No schema changes.

## 3. Forgot Password — functional reset

Current `src/routes/forgot-password.tsx` already calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: /reset-password })`. That's the correct built-in path; no edge function is required for Supabase's own recovery email.

However, since the user wants branded delivery, use the project's existing Lovable auth email infrastructure:

- Run `email_domain--check_email_domain_status`.
- If no domain: surface the email-domain setup dialog first.
- If domain exists: call `email_domain--scaffold_auth_email_templates` to generate branded recovery + other auth templates and the `/lovable/email/auth/webhook` route. Apply Tag brand colors (navy `#031C4D`, mint) to the scaffolded templates.
- Keep the existing `forgot-password.tsx` and `reset-password.tsx` pages as-is — they already work; the scaffold just makes the delivered email branded and reliable.
- Verify by triggering a reset from the UI and confirming the email arrives and `/reset-password` updates the password.

No custom edge function will be authored — Lovable's managed auth-email route replaces that need and is the sanctioned path on this stack.

## Out of scope

- No changes to sidebar, hero, stock, or store admin work from prior turns.
- No new tables or RLS changes.
- Phone mockup illustration on the QR Tags sample is not implemented.

## Technical notes

- Interest ring: inline SVG, `stroke-dasharray` based on `2 * π * r`, mint stroke on a muted track; keep in `products-table.tsx`.
- Buttons: reuse existing `Button` with `variant="default"` for navy CTA; add a local `outline` variant only if the current one doesn't match.
- All colors go through existing tokens in `src/styles.css` (no hardcoded hex in components beyond tokens already defined).
