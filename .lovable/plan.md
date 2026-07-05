
## 1. Product hero — 3-column layout with a real QR block

`src/routes/_authenticated/products.$productId.tsx`:
- Grid becomes `md:grid-cols-[220px_minmax(0,1fr)_200px]`: image · details · QR column.
- Remove the `MiniProductQr` overlay from the image.
- Right column renders `QrPreview` at `size={168}` using `${scanBase}/api/public/s/${short_code}` plus a small "Open QR panel" link that scrolls to `#product-qr`.
- If no active QR yet: show a "Generate QR" button that calls `regenerateProductQr` inline (same fn used by `ProductQrPanel`), then refreshes the query.
- Delete `src/components/qr/mini-product-qr.tsx`.

## 2. QR not working in production

Cause: `getPublicScanBase` falls back to the *current* request host. QRs generated on the preview host (`id-preview--…lovable.app`) encode preview URLs; those bounce/expire off-network.

Fix (no code change beyond the secret):
- Set `PUBLIC_SITE_URL = https://www.mypenguin.co.za` via `set_secret`. `getPublicScanBase` already prefers it. `/api/public/s/<code>` route is the same on both hosts.
- Add a small "Reprint" hint on the QR panel when the stored short_code was created against a non-production origin — non-blocking; user can `Regenerate` from that panel.
- Verification: after secret set, curl `https://www.mypenguin.co.za/api/public/s/<any active short_code>` returns 302.

## 3. Alerts + Campaigns — remove orange row/status tinting

- `notifications.index.tsx` `STATUS_TONE`: drop the amber/orange for `sending` → use neutral `bg-muted text-foreground`; keep only semantic success (sent/completed) and destructive (cancelled) at low opacity.
- Alerts (`_authenticated/alerts.tsx`): replace amber row backgrounds/badges with neutral `bg-muted/40` + a single `Badge variant="outline"` for severity; only "critical" keeps a destructive dot.
- Apply the shared row-hover class (see §7) to align with other tables.

## 4. Badges — make them pop consistently

- Extend `src/components/ui/badge.tsx` with three new variants used across screens:
  - `success` (green fill), `warning` (amber fill, used ONLY for genuine warnings — not row backgrounds), `info` (blue fill), each with matching foreground token.
- Update status/intent chips (`intent-badge`, campaign/alert/customer status, product status, QR active/retired, watchlist status) to use these variants instead of ad-hoc `bg-*` classes.
- Slightly larger default padding (`px-2.5 py-1`, `text-[11px]`, `font-semibold`, `rounded-full`) so they read as pill chips.

## 5. Campaigns CRUD

`src/lib/notifications.functions.ts` (add) + `notifications.index.tsx` / `notifications.$campaignId.tsx`:
- `updateCampaign` (title, headline, body, image_url, type, scheduled_at, audience filter) — only when `status in ('draft','scheduled')`.
- `duplicateCampaign` — clone as draft.
- `cancelCampaign` — allowed for `scheduled` / `sending`.
- `deleteCampaign` — hard delete only when `status = 'draft'`; otherwise soft-cancel.
- UI: row-level dropdown (Edit / Duplicate / Cancel / Delete) on the list, and Edit + Cancel + Delete buttons in the campaign detail header. Reuse the existing new-campaign form as an "edit" mode.
- Role gate: `retail_admin` / `store_manager` / `super_admin`.

## 6. Customers CRUD

`src/lib/customers.functions.ts` (add):
- `createCustomer`, `updateCustomer` (full_name, whatsapp_e164, status, marketing/notify consent flags, tags), `deleteCustomer` (blocked if related recoveries exist — offer archive instead), `setCustomerStatus`.
- `customers.tsx`: "Add customer" button in the toolbar, per-row dropdown (Edit / Message / Archive / Delete), edit dialog reusing form components.
- WhatsApp number validated with the same E.164 helper already used in `notifications.new.tsx`.

## 7. Stock CRUD

`src/routes/_authenticated/stock.tsx`:
- Inline editable `stock_qty` and `low_stock_threshold` per row (double-click to edit, Enter to save) → `updateProduct` in `products.functions.ts`.
- Bulk "Adjust stock" dialog for selected rows (set to / add / subtract).
- Bulk "Restock alert threshold" dialog.
- CRUD delete/archive already lives on Products; expose the same row menu here for consistency.

## 8. Per-product Generate QR + Archive shortcuts

`src/components/products/products-table.tsx` row dropdown gains:
- "Generate / Regenerate QR" → calls `regenerateProductQr({productId, template:'classic'})`, toast + refresh.
- "Archive" and "Unarchive" (unarchive sets status back to `active`) alongside existing Edit / Delete.
- Same menu is added to Stock, Compare, QR Tags, Watchlist rows.

## 9. Consistent row highlighting across all list screens

Create `src/components/ui/data-row.css` tokens + a small helper class `.data-row` that all list rows use:
- Base `bg-card`, `border-b border-border`.
- Hover: `hover:bg-muted/60`.
- Selected: `data-[state=selected]:bg-primary/8 data-[state=selected]:border-l-2 data-[state=selected]:border-l-primary`.
- Zebra OFF everywhere (removes the mixed orange/amber rows on Alerts/Campaigns).
Apply to: Customers, Products, Stock, QR Tags, Watchlists, Compare, Alerts, Campaigns, Scans, Inbox lists. No per-row tint by status — status is communicated via the new badge variants only.

## 10. Inbox — respond to customer WhatsApps

`src/routes/_authenticated/inbox.tsx` currently shows conversations read-only. Add:
- Right-pane message thread with input + Send button.
- New server fn `sendInboundReply` in `src/lib/inbox.functions.ts` — inserts a `conversation_messages` row (`direction=outbound`, `channel=whatsapp`) and calls the existing WhatsApp helper in `src/lib/whatsapp.server.ts` to dispatch via Twilio using `TWILIO_WHATSAPP_FROM` + `TWILIO_API_KEY`. Marks conversation `unread_count = 0`, updates `last_message_at`.
- Internal notes toggle (`is_internal = true`) — no outbound send.
- Uses conversation → customer `whatsapp_e164`; refuses send if customer not `subscribed` (Twilio 24-hour session rule surfaces a clear toast if outside window).
- Optimistic append + realtime refetch on send.

## Technical details

Files touched:
- `src/routes/_authenticated/products.$productId.tsx`, delete `src/components/qr/mini-product-qr.tsx`.
- `src/components/ui/badge.tsx`, `src/styles.css` (add success/warning/info tokens if missing).
- `src/routes/_authenticated/notifications.index.tsx`, `.new.tsx`, `.$campaignId.tsx`, `src/lib/notifications.functions.ts`.
- `src/routes/_authenticated/customers.tsx`, `src/lib/customers.functions.ts`, new `src/components/customers/customer-form-dialog.tsx`.
- `src/routes/_authenticated/stock.tsx`, `src/lib/products.functions.ts` (add `bulkAdjustStock`).
- `src/components/products/products-table.tsx` (row menu additions).
- `src/routes/_authenticated/alerts.tsx` (colour cleanup).
- `src/routes/_authenticated/inbox.tsx`, `src/lib/inbox.functions.ts`, uses `src/lib/whatsapp.server.ts`.
- Shared table row class added to `src/styles.css` and applied via `src/components/ui/table.tsx` (`TableRow` default className).

Backend:
- Secret: `PUBLIC_SITE_URL = https://www.mypenguin.co.za`.
- No schema changes required (all needed columns already exist on `customers`, `notification_campaigns`, `products`, `conversations`, `conversation_messages`).
- RLS: existing policies already allow retailer-scoped CRUD via `belongs_to_retailer` / `can_manage_retailer`; new server fns will call under `requireSupabaseAuth` and rely on those.

Out of scope for this pass: schema migrations, new tables, and any changes to email/auth flows.
