## Changes

### 1. Auto-categorise uncategorised products (no button)
- In `src/routes/_authenticated/admin.categories.tsx` (or the CategoryAdminTab it renders), remove the manual "Auto-categorise uncategorised" bulk button.
- Trigger auto-categorisation automatically: on mount of the Categories admin screen, if uncategorised products exist, kick off `suggestCategoryForProduct` in background batches with a subtle progress indicator (toast/inline). Also fire the same background sweep once from the Dashboard loader path (guarded so it only runs when count > 0 and not more than once per session) so it self-heals without visiting Admin.
- Keep the per-product override UI intact.

### 2. Remove grey divider line on sidebar/nav
- In `src/components/app-sidebar.tsx`, remove `border-b border-sidebar-border/60` from `SidebarHeader` and `border-t border-sidebar-border/60` from `SidebarFooter` so no horizontal line crosses the logo.
- Verify no wrapper in `__root.tsx` or auth layout adds a top border across the header.

### 3. New logo on hero / landing page
- In `src/routes/index.tsx` (hero/landing), render `TagLogo` variant `wordmark` at a reasonably large but restrained size (e.g. `h-16 md:h-20`, not full-width). Ensure it uses the new `tag-logo-clear.png` asset already wired into `TagLogo`.

### 4. Dashboard layout: 3-up row
- In `src/routes/_authenticated/dashboard.tsx`, restructure so **Top products by interest**, **Popular stores**, and **Scan heatmap** sit in a single responsive row (`grid gap-4 lg:grid-cols-3`), replacing the current 2-column split + full-width heatmap block.
- The heatmap card will be compacted to fit its column (horizontal scroll preserved inside).

### 5. Move Signal Contributions to Insights (top)
- Remove `<SignalContributionsCard />` from `src/routes/_authenticated/dashboard.tsx`.
- Add it to the top of `src/routes/_authenticated/intelligence.insights.tsx` (Insights screen), above existing content.

## Technical notes
- No schema changes.
- Auto-categorisation reuses existing `suggestCategoryForProduct`; background trigger uses a `useEffect` + in-flight ref to avoid double runs.
- Heatmap in a narrower column: keep min cell width (`minmax(14px,1fr)`) with overflow-x-auto wrapper already present.
