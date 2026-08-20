# Fix "Could not find the 'email' column of 'customers'" when unsubscribing

## What's happening

The customer record in the database has no email field, but the app's customer form and the create/update customer logic both send one. Unsubscribing a customer goes through that same update path (it sends the whole form back, including email), so the database rejects the write with the schema-cache error shown in the toast.

Confirmed: the `customers` table currently stores full name, WhatsApp number, status, consent timestamps, source, locale, retailer — no email column.

## The fix — remove email entirely

Customers are WhatsApp-only, so email is dropped rather than added to the database:

- Remove the email input from the Add/Edit customer dialog.
- Remove email from the customer validation schema and from the create/update customer logic so it is never sent to the database.
- No database change.

Unsubscribing then writes only real fields and succeeds.

## Logo sizing

- Hero / sign-in logo: increase 30% (from `h-[7.18rem]` to about `h-[9.33rem]` in `src/components/auth-shell.tsx`), keeping its right alignment with the "Welcome back" card.
- Sidebar nav logo: increase 40% (from `h-[8.1rem]` to about `h-[11.34rem]` in `src/components/app-sidebar.tsx`), same rounding and placement.

## Inline toggles on each customer row

In the Customers list (`src/components/customers/customers-view.tsx`), add three switches directly on each row so no dialog is needed:

- Subscribed — flips status between `subscribed` and `unsubscribed`.
- Marketing consent — sets or clears the marketing consent timestamp.
- Notifications — sets or clears the notify consent timestamp.

Each switch saves only its own field through the existing update-customer function, updates immediately, and reverts with a toast if the save fails. The Edit dialog stays available for names and numbers.
