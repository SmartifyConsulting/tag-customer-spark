# My Tag = shopper QR, camera only on Scanner

## What changes

**1. My Tag screen becomes the shopper's Tag card (no camera)**

Today "My Tag" runs a live camera preview alongside the QR code, so the camera light stays on even when the user only wanted their code. The screen becomes a clean Barcode Tagger card:

- The QR code auto-generated at sign-up (the shopper's Tag ID), shown large.
- Tag ID text plus the account email under it.
- A scannable barcode rendering of the same Tag ID (same component the TAG ID page uses), so a till scanner can read it.
- Copy and Download PNG actions.
- A link/button "Scan a product" that goes to the Scanner tab for anyone who lands here expecting the camera.

No `getUserMedia` call is made on this screen at all.

**2. Camera runs only while the Scanner tab is on screen**

The Scanner tab (`/tagged`) keeps the live reader. The camera hook is tightened so the stream is released whenever the scanner is not the visible screen:

- Released on unmount (navigating to any other tab).
- Released when the browser tab/app is backgrounded, re-acquired on return (already in place).
- Released as soon as a barcode is detected and the redirect starts, instead of staying live during the hand-off.

## Technical notes

- `src/routes/_authenticated/barcode-tagger.tsx`: drop `useBarcodeScanner`, the video element, and the detected-barcode panel; render the shopper tag from `getMyShopperTag` using `QrPreview`, `Barcode` (`@/components/ownership/shared`) and `useQrPngDownload`.
- `src/hooks/use-barcode-scanner.ts`: add an explicit `stop()` return and stop the stream on detection; the Scanner page calls it before redirecting.
- `src/routes/_authenticated/tagged.tsx`: unchanged behaviour apart from stopping the camera on detection.
- Head metadata on the My Tag route updated to match the new content.
