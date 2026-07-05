## 1. Alphabetic A–Z filter bar on Customers

Add a horizontal row of alphabet chips (All, A–Z, #) above the Customers list, matching the "My Patients" pattern from Holarc Health.

- `src/routes/_authenticated/customers.tsx`: add `letter` state, render toggle-style chips (mint fill when active), reset `page` on change.
- `src/lib/customers.functions.ts`: extend `listCustomers` with optional `letter`. `#` → `full_name ~* '^[^A-Za-z]'`; letter → `ilike full_name '<L>%'`; `all` → no-op.
- Include `letter` in the query key.

## 2. Inbox as its own top-level nav item

- `src/lib/nav.ts`: add a new top-level entry `{ title: "Inbox", url: "/inbox", icon: Inbox, match: ["/inbox"] }`, placed between "Alerts & Campaigns" and "Customers & Leads". Remove `/inbox` from the Dashboard `match` array so the active state doesn't leak.
- No changes needed in `AppSidebar` or `MobileBottomNav` — both iterate `NAV` and pick it up automatically. Route `/inbox` already exists.

## 3. Company logo upload → public URL for Twilio templates

Replace the free-text "Logo URL" field with a real upload to the existing public `retailer-logos` bucket, then prominently display the resulting public URL so it can be copied into Twilio content templates.

- Server: new `uploadRetailerLogo` in `src/lib/settings.functions.ts`
  - `requireSupabaseAuth`; input `{ filename, contentType, base64 }` (Zod-validated, max ~2 MB, `image/png|jpeg|webp|svg+xml`).
  - Upload to `retailer-logos/{retailer_id}/logo-{timestamp}.{ext}`, `getPublicUrl`, update `retailers.logo_url`, return `{ url }`.
- UI in `src/routes/_authenticated/settings.tsx` Workspace tab — replace the Logo URL input with a "Company logo" card:
  - Thumbnail preview + "Upload logo" button (hidden file input, reads to base64, calls server fn).
  - **Twilio media URL row** shown whenever `logo_url` exists:
    - Read-only monospaced `<Input>` containing the absolute public URL, always visible.
    - "Copy URL" button (`navigator.clipboard.writeText`), toast "URL copied — paste into Twilio Content Template `{{media_url}}`".
    - "Open" link button to verify in a new tab.
    - Hint text: "Paste this URL into Twilio Content Template Builder as the media URL, or into the `MediaUrl` param when sending via the API."
  - Empty state: upload button + "Upload a logo to get a shareable URL for Twilio."
- No DB migration (column and bucket exist).

## 4. Billing Admin capability for System Admins

- `src/lib/billing.functions.ts`: `resolveActiveRetailer` and pay/change fns already accept `super_admin` — no new role.
- `src/routes/_authenticated/settings.tsx`: render the Billing tab's "Change plan" section for super_admins even without an active retailer, with a notice "Acting as system admin — use Plan admin tab to change any workspace's tier."
- `src/components/settings/plan-admin-tab.tsx`: rename card to "Billing administration".

## 5. PayFast + PayPal on every paid plan (not only Pro)

- `src/components/settings/billing-tab.tsx` `PlanCard`: remove the `isCurrent → disabled` short-circuit for paid plans; render both provider buttons on every paid plan card regardless of current tier. Show a "Current" chip when `isCurrent`. Keep Starter free but add a "Downgrade to Starter" outline button when the current tier is Pro/Enterprise. Include the cycle in the button label.

## 6. Easy plan change (upgrade / downgrade)

- Server: new `changePlan` in `src/lib/billing.functions.ts`
  - `requireSupabaseAuth` + `retail_admin`/`super_admin`.
  - Input `{ tier: "starter"|"pro"|"enterprise", cycle: "monthly"|"annual" }`.
  - Downgrade to starter: mark subscription `cancel_at_period_end = true`; if none active, set `retailers.tier = 'starter'` immediately.
  - Same-provider tier switch with active subscription: `apply_paid_tier` with existing provider/cycle.
  - New paid subscription still goes through PayFast/PayPal.
  - Insert `audit_logs` row.
- UI in `BillingTab`: "Change plan" summary strip above the plan grid + "Switch to <plan>" button on each paid card when an active paid subscription exists.
- Safety: `changePlan` never grants paid tier without an active subscription.

## 7. "Back in stock" badge → teal

- `src/components/notifications/status-badge.tsx`: change `TYPE_COLORS.back_in_stock` from `bg-emerald-600` to `bg-teal-500 text-white`.
- Apply same teal to other "back in stock" chips in `src/routes/_authenticated/watchlists.tsx` and `src/components/notifications/campaign-composer.tsx`.
- Leave "Sent/Completed" badges emerald.

## Out of scope

- No DB migrations. No new roles.
- No changes to Twilio message templates themselves — this plan only makes the logo URL easy to obtain, verify, and copy into Twilio.
