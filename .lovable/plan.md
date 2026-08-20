# Fix "Could not find the 'email' column of 'customers'" when unsubscribing

## What's happening

The customer record in the database has no email field, but the app's customer form and the create/update customer logic both send one. Unsubscribing a customer goes through that same update path (it sends the whole form back, including email), so the database rejects the write with the schema-cache error shown in the toast.

Confirmed: the `customers` table currently stores full name, WhatsApp number, status, consent timestamps, source, locale, retailer — no email column.

## The fix

Add an optional `email` field to the customer record so the app and the database agree. The existing email box in the Add/Edit customer dialog then saves properly, and unsubscribing stops erroring.

- Database migration: add a nullable `email` text column to `customers`.
- No code changes needed — the form, validation, and update logic already handle email.

## Alternative

If email should not be stored on customers at all, the other route is to strip the email field from the customer form and the create/update logic instead. Say the word and I'll switch the plan to that.

## Logo sizing

- Hero / sign-in logo: increase 30% (from `h-[7.18rem]` to about `h-[9.33rem]` in `src/components/auth-shell.tsx`), keeping its right alignment with the "Welcome back" card.
- Sidebar nav logo: increase 40% (from `h-[8.1rem]` to about `h-[11.34rem]` in `src/components/app-sidebar.tsx`), same rounding and placement.

## Inline subscribe / notify toggles

In the Customers list (`src/components/customers/customers-view.tsx`), add two switches directly on each row so no dialog is needed:

- Subscribed — flips status between `subscribed` and `registered` (and sets/clears the marketing consent timestamp).
- Notifications — sets/clears the notify consent timestamp.

Each switch calls the existing update-customer function with only that one field, shows an optimistic state, and reverts with a toast if the save fails. The Edit dialog stays available for everything else.
