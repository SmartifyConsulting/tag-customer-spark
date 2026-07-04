# Fix invalid QR codes

Two bugs make scanned QR codes fail:

## 1. QR encodes the current browser origin
`src/components/qr/product-qr-panel.tsx` builds the QR value from `window.location.origin`. When you generate a QR inside the Lovable preview (`id-preview--…lovable.app`), the printed code points at that ephemeral preview host. Scanning it from a phone either 404s (preview host gone / different session) or hits the wrong environment.

**Fix:** resolve the QR base URL server-side from a stable canonical host, in this order:
1. `process.env.PUBLIC_SITE_URL` (e.g. `https://mypenguin.co.za`)
2. Custom domain / published URL from request headers when generating
3. Fallback to `window.location.origin`

Expose the resolved base via a small server function (`getPublicScanBase`) that the product QR panel and bulk QR dialog call once, and encode `{base}/api/public/s/{shortCode}` into the QR image. This makes printed codes portable across preview, published, and custom-domain deployments.

## 2. `throw redirect(...)` doesn't redirect from a server route handler
In `src/routes/api/public/s.$shortCode.ts` the handler ends with:

```ts
throw redirect({ href: `${url.origin}/scan/${shortCode}` });
```

`redirect()` from `@tanstack/react-router` is a router-side navigation helper for loaders/components. Inside a raw server route handler it doesn't produce an HTTP 302 — the response the scanner gets is an error/empty body, so the phone browser shows "cannot open page". That is exactly the "not valid" behaviour.

**Fix:** return a real HTTP redirect:

```ts
return new Response(null, {
  status: 302,
  headers: { Location: `${base}/scan/${shortCode}` },
});
```

Use the same canonical base as (1) so redirects land on the published scan page, not the preview host embedded in `request.url`.

## 3. Scan-page sanity check
Verify `/scan/$shortCode` renders without auth (it lives outside `_authenticated/`, so it should — just confirm the loader uses only public server functions).

## Technical details
- New server fn `getPublicScanBase` in `src/lib/qr.functions.ts` returning `PUBLIC_SITE_URL` or derived host.
- Update `product-qr-panel.tsx` and `bulk-qr-dialog.tsx` to await that base instead of reading `window.location.origin`.
- Replace `throw redirect(...)` in `s.$shortCode.ts` with a `Response` 302; log scan insert errors instead of swallowing.
- No schema changes. No UI/style changes.

After this, generating a QR in preview and scanning it on a phone will hit `mypenguin.co.za/api/public/s/<code>` → 302 → `/scan/<code>` with the customer opt-in form.
