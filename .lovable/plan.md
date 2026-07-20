## 1. Briefing page — treat the reference image as the exact layout

Reference layout (from the attached mockup):
- Top-left of the content area: bold `Hello Makro` + daily briefing subtitle.
- Sidebar nav starts *below* that header row (nav's first item aligns roughly with the greeting's baseline, not the very top of the viewport).
- `Intelligence` shows expanded sub-items (Dashboard, Insights, Analytics, ROI, Trends, Forecasting) inline in the sidebar.
- Large TAG logo/card sits top-right of the content area.
- `Briefing` is the highlighted nav item.

Changes:
- `src/routes/_authenticated/route.tsx`: keep greeting top-left of the app header, keep the large TagLogo top-right. Add top padding to the sidebar (`SidebarHeader` becomes a fixed-height spacer) so the first nav item (`Briefing`) starts on the same row as the greeting's subtitle — matching the mockup's vertical offset.
- `src/lib/nav.ts`: restore `items` on the Intelligence entry (Dashboard, Insights, Analytics, ROI, Trends, Forecasting) so its sub-items render expanded in the sidebar. Admin stays a single top-level link (tabs already handle its sub-sections in-page).
- `src/components/app-sidebar.tsx`: force `Intelligence` group `defaultOpen` and keep it open (no collapse) so the sub-items are always visible like the mockup. Remove the small in-sidebar Tag icon that was moved earlier.
- `src/routes/_authenticated/briefing.tsx`: remove the inline `Hello Makro` heading I added — the greeting lives only in the app header now. Row structure stays as last agreed: KPIs / Heatmap+Intent / WhatsApps+Tagged.

Nothing else on Briefing changes — no new frames, no recoloring beyond what's already shipped.

## 2. Hero (auth) page — 3cm spacer between logo and sign-in frame

File: `src/components/auth-shell.tsx`.

- Add `pt-[3cm]` to the two-column grid wrapper (line 19) so both the hero copy column and the sign-in/up card column start 3cm below the `MarketingHeader` logo row. That keeps the sign-in frame vertically aligned with the hero copy (they share the same grid row), and gives the requested 3cm gap between the logo and the sign-in frame.
- No changes to logo size, nav pills, or the sign-in card itself.

## Technical notes

- 3cm resolves via Tailwind's arbitrary value support (`pt-[3cm]`) which Lightning CSS emits as `padding-top: 3cm`. Browsers render `cm` against the CSS reference pixel (1cm ≈ 37.8px), so the visual gap is consistent across viewports.
- Sidebar top spacer height will be set to match the header's greeting block (`h-24` / `pt-24` range) so the first nav item lines up with the subtitle baseline as shown in the mockup — exact value tuned during build against the live preview.
- Intelligence sub-items are already routed (`intelligence.tsx`, `analytics.tsx`, `roi.tsx`, `trends.tsx`, `forecasting.tsx`, `insights.tsx`); this only restores their sidebar entries.
