# Sidebar position, Automations placement, avatar styling

## 1. Move the nav list up (keep breathing room under the logo)

The nav currently starts with a large `pt-[3.1875rem]` gap under the Tag logo. Reduce that top padding to roughly a third (about `pt-4`), so the first heading ("Product") sits noticeably higher while still keeping clear padding between the logo and the heading.

## 2. Automations is no longer a sub-item of Admin

Admin becomes a plain single destination again (no chevron, no expandable sub-menu). Automations moves out to its own top-level entry in the Business section, admin-only, pointing at `/automations` with its own icon. Order in Business: Customers, Admin, Automations, Pricing. The `/automations` screen itself does not change.

## 3. Avatar and profile row styling

- Avatar circle: solid orange (the Tangerine brand token) with white initials.
- On hover of the profile row: the circle reverses (white circle, orange initials), and the name flips to a solid orange background with white text.

Hover styling is done with group-hover classes on the trigger button so both parts react together.

## Technical notes

- `src/components/app-sidebar.tsx` — reduce `SidebarContent` top padding.
- `src/lib/nav.ts` — remove the `items` array from the Admin nav item; add a standalone `Automations` NavItem (`adminOnly: true`, `match: ["/automations"]`).
- `src/components/user-menu.tsx` — restyle `AvatarFallback` and the name span with brand tokens (no hardcoded hex/`text-white`), adding `group` on the trigger for the reversed hover state.
