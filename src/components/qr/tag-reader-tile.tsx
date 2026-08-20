import { QrPreview } from "@/components/qr/qr-preview";

// Compact Tag Barcode Reader QR tile — sits at the bottom of the left nav
// panel, just above the search bar. White rounded frame sized to snugly
// fit the QR code's dark modules (minimal padding, tight quiet zone), at
// 12rem — the Tag logo above it is sized to match (see app-sidebar.tsx).
export function TagReaderTile({ compact = false }: { compact?: boolean }) {
  const readerUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tools/barcode-reader`
      : "/tools/barcode-reader";

  return (
    <div
      className={`flex items-center justify-center rounded-2xl bg-white ${
        compact ? "h-[12rem] w-[12rem] p-2" : "p-5"
      }`}
    >
      <QrPreview value={readerUrl} size={compact ? 176 : 192} bare margin={compact ? 2 : 4} />
    </div>
  );
}
