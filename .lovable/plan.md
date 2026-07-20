## 1. Why Intelligence isn't expanding

Intelligence in `src/lib/nav.ts` is gated behind `feature: "roi"`. Your tier doesn't include it (you're on `/upgrade?feature=roi` right now), so in `app-sidebar.tsx` the `locked` branch skips the `Collapsible` and renders Intelligence as a single upgrade link with no sub-items.

Fix: remove the `feature: "roi"` gate on the Intelligence group. Sub-items (ROI, Forecasting) can keep individual tier locks — locked ones link to `/upgrade` instead of hiding.

## 2. Product screen — rearrange to match the mock

Edit `src/components/products/product-detail-view.tsx` only (presentation change).

### Header card (single row)
- Left: hero image (~160px).
- Middle: title + SKU + price + `Active` badge, plus a compact 2-column facts grid (Category, Store, Stock, Low at) as bordered input-style tiles.
- Right: `Digital Identity Build` checklist inline (reuse `DigitalIdentityProgress` with 6/7 progress bar) — no separate card.
- Top-right corner: icon-only Archive, Delete, Edit buttons (ghost). Remove the text Archive / Delete / Refresh image row.

### Merged QR + Passport card (replaces two blocks)
- Two-column card:
  - Left: `QR STATUS` + existing `ProductQrPanel` visual.
  - Right: `Digital Product ID` header with `ENRICHED` badge + `Re-enrich` button top-right, then passport fields (Brand, Manufacturer, Country of origin, Category, Short/Marketing description, Ingredients, Allergens, Warranty, Sustainability) in the label/value grid shown in the mock.
- Replaces the `ProductQrPanel` + `DigitalIdentityProgress` row AND the full-width `PassportTab` block below. `PassportTab` file stays for reuse.

### Below the merged card
- Keep `ProductIntentPanel` (Intent Score).
- Remove the Scans / Analytics tabs block (not in mock).

### Kept behaviours
- Auto-complete digital identity effect, edit dialog, delete confirmation, GTIN clash toast.
- `canManage` still gates Archive/Delete/Edit/Re-enrich.

## 3. Product-image resolution — add Vision verification

Problem: Serper returns candidates that are often the wrong pack size, category thumbnails, or watermarked listings, so the "first result" heuristic in `src/lib/product-images.server.ts` picks bad images. GPT-5 Vision can look at a candidate and *judge* whether it actually depicts the product; it can't search the web itself, so Serper stays as the retrieval step.

New pipeline in `src/lib/product-images.server.ts`:
1. Retailer/Open Food Facts URL (unchanged).
2. Serper image search (unchanged) — pull top **N=6** candidates instead of 1.
3. **Vision verification (new)** — one call to `openai/gpt-5-mini` (vision-capable, cheapest suitable model on the Lovable AI Gateway allowlist) via the AI SDK, with the product name/brand/GTIN/category as text and the N candidate image URLs as `image_url` blocks in one message. Structured output returns `{ bestIndex: number | null, confidence: "high" | "medium" | "low", reason: string }`. Uses `createLovableAiGatewayProvider(..., { structuredOutputs: true })` per gateway rules.
4. If `bestIndex != null` and confidence >= medium → store that URL. Otherwise fall back to internal AI image generation (existing behaviour).

Guardrails:
- Wrap the call in the standard `NoObjectGeneratedError` fallback (parse `error.text`, else skip verification and use the first Serper hit — never crash the resolver).
- Rate/credit errors (429/402) surface via the existing toast path; resolver marks image_status=`failed` and moves on.
- No schema bounds; N=6 stated in the prompt, clamped in code.
- Runs only when Serper returns >=2 candidates (single-hit case skips verification to save a call).

## Files touched
- `src/lib/nav.ts` — drop `feature: "roi"` on Intelligence group.
- `src/components/products/product-detail-view.tsx` — restructure JSX.
- Minor prop tweaks to `PassportTab` / `DigitalIdentityProgress` for inline rendering (no card chrome).
- `src/lib/product-images.server.ts` — request N Serper candidates + Vision verification step.
- No DB migration; no new secrets (uses `LOVABLE_API_KEY` already in place).
