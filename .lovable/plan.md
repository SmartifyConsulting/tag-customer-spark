The sidebar was reverted to the old multi-group expanded structure. Restore the flat 5-item icon-only nav that pairs with the SectionTabs strip.

## Changes

**`src/components/app-sidebar.tsx`**
- Replace the 8-group `NAV` array with a flat 5-item list matching the section tabs:
  1. Dashboard → `/dashboard` (LayoutDashboard)
  2. Engagement → `/alerts` (Bell)
  3. Intelligence → `/intelligence` (Sparkles)
  4. Performance & ROI → `/analytics` (BarChart3)
  5. Management → `/settings` (Settings)
- Remove `SidebarGroupLabel` rendering (no group headings).
- Render items as a single `SidebarMenu` with icon-only styling (label hidden, tooltip on hover).
- Keep navy background + mint active indicator already in place.
- Keep the enlarged logo header and footer untouched.

Active-state matching should use the section's route prefix (e.g. `/intelligence/*` keeps Intelligence active) so sub-routes still highlight the correct top-level item — same logic `SectionTabs` uses.

No other files change.