## Redesign AI Opportunity Feed as a scannable table

Replace the current stacked-list layout in `src/components/dashboard/opportunity-feed.tsx` with a compact table that matches the requested columns:

| Product | AI Action | Store Flow | Signal | Revenue | Confidence | Actions |

### Column mapping (from existing `ai_insights` rows)

- **Product** — `op.payload.product_name` → fallback to `op.title`. Prefix with an emoji derived from `payload.category` (👕 apparel, 👖 denim, 👢 footwear, 📦 default).
- **AI Action** — badge from `payload.action` (`transfer` ⇄, `markdown` 🏷, `restock` 📦, `promote` ✨). Fallback derived from `op.kind` (`opportunity` → Promote, `merchandising` → Markdown).
- **Store Flow** — `payload.from_store → payload.to_store`; single store if only one; em‑dash when absent.
- **Signal** — `payload.signal` chip (📦 stock delta, 📉 slow sales, ⚠ low stock, 📈 high demand). Falls back to a truncated `op.body`.
- **Revenue** — existing `formatZAR(payload.projected_value_cents)`, right‑aligned, success color.
- **Confidence** — `op.score` (0–100). Colored dot: 🟢 ≥ 90, 🟡 70–89, 🔴 < 70. Text `xx%`.
- **Actions** — `View` (links to related product if `related_entity_type === 'product'`, else no‑op ghost) + a contextual primary button per action (`Create` transfer, `Apply` markdown, `Order` restock, `Promote` default). Both are `size="sm"`. Dismiss (X) moves into a row‑hover icon button at the far right.

### Layout & styling

- Wrap the list in `<Table>` from `@/components/ui/table` inside the existing `CardContent`.
- Keep the executive-briefing panel above the table unchanged.
- Sticky, uppercase, tracking‑wide header row; zebra rows via `hover:bg-muted/40`.
- Responsive: on `< md`, hide **Store Flow** and **Signal** columns; keep Product / Action / Revenue / Confidence / Actions.
- Preserve loading skeletons (swap to 3 skeleton rows shaped like the table) and empty state.
- No changes to server functions, data model, or the locked/Tag‑Pro gate.

### Small helpers (inline in the same file)

- `actionMeta(action)` → `{ icon, label, verb }` map.
- `signalMeta(signal)` → `{ icon, label }` map.
- `confidenceMeta(score)` → `{ dot, tone }`.

### Files touched

- `src/components/dashboard/opportunity-feed.tsx` — full rewrite of the render block; imports add `Table*` primitives and `ArrowLeftRight`, `Tag`, `PackagePlus`, `AlertTriangle` icons from `lucide-react`.

No migrations, no other components affected.