# Signups list, simpler nav, more colour, tidier auth page

## 1. Admin → Users: show everyone who signed up

Today the Users tab only lists invited **staff** records. It never shows people who signed up themselves.

Add a second panel, "All signups", above the staff list:

- One row per registered account, showing: name (best available), email, signed-up date, and an account-type badge — **Retailer** or **Shopper**.
- Name resolution order: profile full name → the retailer/store name they registered → the name captured at signup → email local-part as a last resort.
- Retailer rows also show the retailer/workspace name; shopper rows show their TAG ID where one exists.
- Simple search box + type filter (All / Retailers / Shoppers) and a count summary ("18 signups · 5 retailers · 13 shoppers").
- Visible to admins only, same as the rest of the Admin screen.

Classification rule: an account with a role row linked to a retailer is a **Retailer**; everyone else is a **Shopper**.

## 2. Navigation clean-up

- Remove the sub-menu under **Analytics** (Overview / Insights / Analytics / ROI) — those surfaces already exist as tabs on the overview screen.
- Rename the "Overview" destination to **Analytics**.
- Move it out of Business and list it directly under **Whatsapps** in the Product section.
- Business keeps Admin and Pricing. Deep links to the old sub-pages keep working; only the menu changes.

## 3. Flood the app with colour

Keep the white base but let coral, tangerine and navy carry much more of the UI:

- Page headers get a soft coral→tangerine wash and a coloured accent rule.
- KPI/stat tiles rotate through the palette instead of all-white cards (coral, tangerine, navy, steel tints) with matching icon chips.
- Badges, tabs, table headers and section titles pick up palette tints rather than grey.
- Sidebar active item becomes a solid coral pill with white text; hovers keep the steel-grey tint.
- Primary buttons get a coral→tangerine gradient; secondary actions use navy outlines.
- Charts already use the palette — extend the same colours to progress bars, empty states and status pills.

## 4. Auth page layout

- Top-align the hero image column and the sign-up/sign-in frame (they currently vertically centre against each other).
- Justify the paragraph under the hero image and stretch it to the full image width (remove the narrower max-width).

## Technical notes

- New authenticated server function in `src/lib/staff.functions.ts` (or a new `signups.functions.ts`) that verifies the caller is an admin, then reads accounts via the admin client inside the handler, joining `profiles`, `user_roles`, `retailers` and `consumer_tag_ids`. No new tables, no schema change.
- New component `src/components/settings/signups-tab.tsx` rendered inside the existing Users tab of `/admin`.
- Nav changes in `src/lib/nav.ts` only (remove `items` from the Analytics entry, move it into the `product` section after Whatsapps).
- Colour work in `src/styles.css` (new gradient/tint utility tokens) plus `page-header.tsx`, sidebar, and dashboard/KPI card components.
- Auth layout tweaks in `src/components/auth-shell.tsx` (`items-start`, `text-justify`, drop `max-w-md` on the paragraph).
