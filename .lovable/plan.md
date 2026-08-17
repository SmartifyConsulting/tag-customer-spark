# UI polish: tabs, logo, layering

## 1. Analytics tabs — black until selected
Unselected tab labels currently render white on a dark pill. Change the tab strip so idle
labels are black (foreground/near-black) on a light pill, and only the selected tab keeps
the coral fill with white text.

- `src/components/ui/tabs.tsx`
  - `TabsList`: light neutral background (muted/steel tint) with a border instead of the
    solid dark bar.
  - `TabsTrigger`: idle text `text-foreground` (black-ish) with a subtle grey hover;
    active state stays `bg-primary text-primary-foreground`.

## 2. App logo matches the hero logo
The in-app header logo uses the same image but at a much larger, differently sized box than
the hero/marketing header, so it reads as a different mark. Set the app header logo to the
same rendering as the hero header (`variant="wordmark"`, height `h-[10.4rem]`, same object
fit), so they are visually identical.

- `src/routes/_authenticated/route.tsx` — header `TagLogo` height matched to
  `src/components/marketing-page.tsx`.

## 3. Remove the logo from the nav menu
Drop the `TagLogo` from the sidebar header so the logo only appears once, in the app header.

- `src/components/app-sidebar.tsx` — remove the logo from `SidebarHeader` and collapse the
  now-empty header spacing.

## 3b. Remove "Scanner" from the nav menu
Remove the Scanner item from the sidebar nav (the Purchase section, whose only item is
Scanner, disappears with it). Mobile bottom nav keeps its existing entries unless you want
it dropped there too.

- `src/lib/nav.ts` — drop the Scanner entry from `NAV_SECTIONS`.

## 4. Bring canvas text in front of the nav menu
Page content currently sits under the sidebar/offcanvas layer where they overlap, hiding
text. Fix the stacking so main content renders above the nav panel on desktop: give the
main content wrapper a positioned stacking context with a higher z-index than the sidebar's
decorative layers, and remove the sidebar's `overflow-visible` bleed that lets it cover
content.

- `src/routes/_authenticated/route.tsx` — `main` gets `relative z-30`.
- `src/components/app-sidebar.tsx` — drop `overflow-visible`.

No backend, data, or business-logic changes.
