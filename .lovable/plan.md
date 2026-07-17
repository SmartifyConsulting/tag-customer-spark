## Switch product image lookup from Google CSE → Serper

Replace the Google Custom Search integration added last turn with Serper's Google Images endpoint. Serper is simpler (single API key, no `cx`), cheaper at scale, and returns richer image metadata.

### Changes

**1. `src/lib/product-images.server.ts`**
- Remove `lookupGoogleImage` (Google CSE) helper.
- Add `lookupSerperImage({ gtin, name, brand })` that:
  - Reads `SERPER_API_KEY` from `process.env`; returns `null` if missing.
  - Builds query: `"<gtin>"` if present, else `"<brand> <name>"` (min length 3).
  - POSTs to `https://google.serper.dev/images` with `{ q, num: 5, safe: "active" }` and header `X-API-KEY`.
  - Iterates `json.images[]`, returns first `imageUrl` that starts with `https://` and looks like jpg/png/webp (by URL extension or after `downloadAndUpload` MIME validation catches it).
  - Silent `null` on any HTTP or parse failure (existing pipeline falls through to AI/brand-logo/placeholder).
- Wire it into `resolveAndSyncProductImage` in the same slot the CSE call occupied — between Open Food Facts and AI generation — so URL priority becomes: retailer → OFF → **Serper** → AI → brand logo → placeholder.

**2. Secrets**
- Request `SERPER_API_KEY` via `add_secret` after plan approval.
- Once confirmed working, delete unused `GOOGLE_CSE_API_KEY` and `GOOGLE_CSE_ID` via `delete_secret`.

**3. No other changes**
- `products.functions.ts`, `import.functions.ts`, UI, and DB schema stay as-is — they already call `resolveAndSyncProductImage`.
- AI model upgrades (`gpt-5.5` / `gpt-5.4-mini`) from the previous turn remain.

### Verification
- Create a test product ("Nike Pegasus 40") → image should populate from Serper within ~2s.
- Re-import a Cape Union Mart row without an image → same.
- Check server logs for `[serper]` warnings on any failure.

### Files touched
- `src/lib/product-images.server.ts` (swap helper + call site)
- Secrets: add `SERPER_API_KEY`, remove Google CSE pair
