import { QrPreview } from "@/components/qr/qr-preview";

// Compact Tag Barcode Reader QR tile — sits at the bottom of the left nav
// panel, just above the search bar. White rounded frame sized to snugly
// fit the QR code's dark modules (minimal padding, tight quiet zone).
//
// The logo above it (app-sidebar.tsx) is declared at 12rem, but its source
// PNG has a lot of transparent padding baked in — measured directly from
// the asset, the actual opaque icon only fills ~75-78% of that square, so
// its true visible footprint is ~11rem, not 12rem. The QR card has no such
// transparent margin (solid white, corner to corner), so it's sized to
// that true 11rem to visually match rather than the logo's declared box.
export function TagReaderTile({ compact = false }: { compact?: boolean }) {
  const readerUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tools/barcode-reader`
      : "/tools/barcode-reader";

  return (
    <div
      className={`flex items-center justify-center rounded-2xl bg-white ${
        compact ? "h-[11rem] w-[11rem] p-2" : "p-5"
      }`}
    >
      <QrPreview value={readerUrl} size={compact ? 160 : 192} bare margin={compact ? 2 : 4} />
    </div>
  );
}
