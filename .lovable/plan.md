## Database Build Plan

Build a fully normalized schema for Tag with 17 tables, RLS scoped to retailer ownership, and realistic demo seed data.

### Conventions applied to every table
- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()` (with `tg_set_updated_at` trigger)
- `created_by uuid references auth.users(id)`
- `status` — table-specific enum (defaulted), never nullable
- `retailer_id uuid` on every tenant-scoped table for fast RLS
- GRANTs to `authenticated` + `service_role` in the same migration
- RLS enabled with policies driven by a `belongs_to_retailer(auth.uid(), retailer_id)` security-definer helper, plus `has_role(auth.uid(), 'super_admin')` override for Super Administrators

### Enums
- `retailer_status`: active, suspended, cancelled
- `store_status`: active, closed, pending
- `staff_status`: active, invited, disabled
- `product_status`: active, draft, archived
- `category_status`: active, archived
- `qr_status`: active, inactive, retired
- `customer_status`: subscribed, unsubscribed, blocked
- `interest_status`: active, notified, converted, expired
- `campaign_type`: sale, low_stock, back_in_stock, promotion
- `campaign_status`: draft, scheduled, sending, sent, cancelled
- `notification_status`: queued, sent, delivered, read, failed
- `conversation_status`: open, closed, archived
- `message_direction`: inbound, outbound
- `message_status`: sent, delivered, read, failed
- `promotion_status`: scheduled, active, ended, cancelled
- `redemption_status`: issued, redeemed, expired, void
- `recovery_status`: attributed, pending, rejected
- `audit_status`: success, warning, failure
- `subscription_status`: trialing, active, past_due, cancelled

### Tables and key relationships

```text
retailers ──┬─ stores ──┬─ staff (also -> auth.users)
            │           └─ qr_tags ─ products
            ├─ product_categories ─ products
            ├─ customers ──┬─ customer_interests ─ products
            │              ├─ conversations ─ conversation_messages
            │              └─ notification_history ─ notification_campaigns
            ├─ promotion_events ─ products
            │                └─ redemption_codes ─ customers
            ├─ sales_recoveries ─ customers, products, notification_history
            ├─ audit_logs (actor_user_id -> auth.users)
            └─ subscriptions (one current per retailer)
```

Notable columns beyond standard fields:
- **retailers**: name, slug, contact_email, plan
- **stores**: retailer_id, name, address, city, country, timezone
- **staff**: retailer_id, store_id, user_id (auth.users), role (app_role), invite_email
- **product_categories**: retailer_id, name, parent_id (self FK)
- **products**: retailer_id, category_id, sku, name, description, price_cents, currency, stock_qty, low_stock_threshold, image_url
- **qr_tags**: retailer_id, store_id, product_id, code (unique), scan_count, last_scanned_at
- **customers**: retailer_id, whatsapp_e164 (unique per retailer), full_name, locale, opted_in_at
- **customer_interests**: retailer_id, customer_id, product_id, qr_tag_id, source
- **notification_campaigns**: retailer_id, type, product_id (nullable), title, message_template, scheduled_at, sent_at
- **notification_history**: retailer_id, campaign_id, customer_id, channel, payload, sent_at, delivered_at, read_at, error
- **conversations**: retailer_id, customer_id, store_id, last_message_at
- **conversation_messages**: conversation_id, direction, body, media_url, status, sent_at
- **promotion_events**: retailer_id, product_id, type (sale/promo), discount_pct, starts_at, ends_at
- **redemption_codes**: retailer_id, promotion_id, customer_id, code (unique), redeemed_at, expires_at
- **sales_recoveries**: retailer_id, customer_id, product_id, notification_id, amount_cents, currency, recovered_at
- **audit_logs**: retailer_id (nullable for platform-level), actor_user_id, action, entity_type, entity_id, metadata jsonb
- **subscriptions**: retailer_id, plan, current_period_start, current_period_end, seats, provider_ref

### RLS model
1. Add `retailer_id` to `user_roles` (nullable) so each role grants membership in a retailer. Super admins keep `retailer_id = null`.
2. Security-definer helpers (`SET search_path = public`, `STABLE`):
   - `current_retailer_ids(uuid) returns setof uuid`
   - `belongs_to_retailer(uuid, uuid) returns boolean`
3. Policies per tenant table:
   - SELECT: `has_role(auth.uid(),'super_admin') OR belongs_to_retailer(auth.uid(), retailer_id)`
   - INSERT/UPDATE/DELETE: same + role gating (admins write, sales_assistant read-mostly via narrower policies on customers/interests/messages)
4. `audit_logs`: insert allowed for any retailer member; select restricted to retail_admin+; super_admin sees all.
5. `subscriptions`: select/update restricted to retail_admin + super_admin.
6. `profiles` + `user_roles` policies stay as-is; add a super_admin SELECT policy on `user_roles` so admins can manage roles later.

### Seed data
Inserted via a follow-up `supabase--insert` call (data, not schema). Plan:
- 2 retailers ("Aurora Apparel", "Cape Coffee Co.")
- 4 stores total across retailers
- 6 staff rows (mix of roles, including one invite-pending). User auth rows are NOT created — staff seeds use null `user_id` except the currently signed-in user is left for the user to claim after they tell us which retailer to attach them to. (Confirming below.)
- 6 product categories, 18 products with varied stock/pricing
- 24 QR tags (one per product + duplicates in second store)
- 30 customers with valid E.164 numbers
- ~60 customer_interests spread across products
- 5 notification_campaigns covering all 4 types
- ~40 notification_history entries with mixed delivery states
- 8 conversations + ~30 conversation_messages (inbound/outbound)
- 4 promotion_events, 20 redemption_codes (mix issued/redeemed/expired)
- 10 sales_recoveries tied to notifications
- ~25 audit_logs across entity types
- 2 subscriptions (one trialing, one active)

### Technical notes
- All schema work goes through one `supabase--migration` (enums + tables + grants + RLS + helpers + triggers).
- Seed data goes through `supabase--insert` after migration approval so generated types reflect the new schema before any frontend wiring.
- No frontend changes in this step — pages remain placeholders.

### One clarification before I write the migration
For the signed-in account currently testing the app, should I:
(a) attach it to **Aurora Apparel** as `retail_admin` in the seed so you can see data immediately, or
(b) leave it role-less (current `sales_assistant` default with no retailer) so you can assign yourself via a future Staff UI?

I'll default to (a) unless you say otherwise when you approve.
