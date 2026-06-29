Restyle the SectionTabs strip site-wide (used by every section, including Engagement) to match the user's spec, and tighten the Engagement tab set so all its existing screens (Customers, Products & QR Tags, Watchlists, Compare) are surfaced prominently. All target screens already exist under `src/routes/_authenticated/` — no new routes needed.

## Changes

**`src/components/section-tabs.tsx`**
- Replace the current understated underline tabs with prominent rounded pill tabs.
  - Active pill: solid mint/green background (`bg-[color:var(--mint)]`), white text, medium weight, subtle shadow — no glow halo.
  - Inactive pill: transparent background, muted foreground, hover → light mint tint + foreground text.
  - Increase padding (`px-5 py-2.5`), font weight, and gap so tabs read as primary navigation rather than a thin strip.
  - Remove the mint underline span and its `shadow-[0_0_10px_...]` glow entirely.
  - Wrap row in a soft surface card (`rounded-full bg-muted/40 p-1`) so the pill bar feels like a control, not a divider.
- Keep sticky behavior, `findActiveSection` / `findActiveTab` logic, and Link routing untouched.

**`src/components/section-tabs.tsx` — Engagement tab order**
- Reorder Engagement tabs for clarity: Customers · Products · QR Tags · Watchlists · Compare.
  (Split the current combined "QR Tags & Catalogue" into two tabs since both routes exist.)

No backend, no new routes, no other sections modified.