# Sidebar footer restore + Customers and Automations as their own screens

## 1. Profile avatar and name back at the bottom left

- The user menu trigger shows a circular avatar with the user's initials (from the profile name, falling back to the email), followed by their name.
- Clicking it still opens the same dropdown (Profile, Settings, Switch profile, Sign out) — no change to that menu.
- The same menu at the top right of the header shows initials again instead of the oversized QR.

## 2. QR code above it, search bar above that

Sidebar footer order, top to bottom:

```text
Tag Barcode Reader QR
Search anything...
Avatar (initials) + user name
```

The QR moves out of the avatar slot into its own block, and the search field sits directly above the profile row, all left-aligned with each other.

## 3. Customers becomes its own screen under Business

- "Customers" is added to the Business nav section as the **first** item, pointing at the existing `/customers` screen.
- The Customers tab is removed from the Admin screen, so customers live in exactly one place.

## 4. Automations becomes its own screen under Admin

- "Automations" is added to the nav menu under Admin as its own destination at a new `/automations` route, not a tab.
- The Automations tab is removed from the Admin screen; the existing automation settings UI (including the live Infobip template picker) renders on the new screen unchanged.

Admin keeps Taxonomy, Stores, and Users as tabs.

## Technical notes

- `src/components/user-menu.tsx`: swap `TagReaderQrBadge` in the trigger for `Avatar` / `AvatarFallback` initials; dropdown untouched.
- `src/components/app-sidebar.tsx`: footer renders the reader QR, then the search input, then `<UserMenu />`.
- `src/lib/nav.ts`: Business section becomes Customers (`/customers`) → Admin → Pricing; Admin gains an `items` sub-entry for Automations (`/automations`), and `match` arrays are updated so only one item highlights per route. Mobile nav's Customers entry points at `/customers`.
- New route `src/routes/_authenticated/automations.tsx` renders `AutomationSettings` with its own page header and head metadata; admin-gated the same way the Admin screen is.
- `src/routes/_authenticated/admin.index.tsx`: drop the `customers` and `automations` tabs from the tab list, contents, and the `tab` search-param enum; redirect those old `?tab=` values to the new screens so existing links keep working.
