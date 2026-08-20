import { QrPreview } from "@/components/qr/qr-preview";

// Compact Tag Barcode Reader QR tile — sits at the bottom of the left nav
// panel, just above the search bar. White rounded frame, matching the Tag
// logo's own white card treatment at the top of the sidebar. The logo has
// a scale-[1.2] transform (see TagLogo), so its true visual footprint is
// 11.34rem * 1.2 — this frame has no scale of its own, so it's sized down
// to 11.34rem / 1.2 (9.45rem) to visually match that, not the logo's
// unscaled declared height.
export function TagReaderTile({ compact = false }: { compact?: boolean }) {
  const readerUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tools/barcode-reader`
      : "/tools/barcode-reader";

  return (
    <div
      className={`flex items-center justify-center rounded-2xl bg-white ${
        compact ? "h-[9.45rem] w-[9.45rem] p-1" : "p-5"
      }`}
    >
      <QrPreview value={readerUrl} size={compact ? 143 : 192} bare margin={compact ? 2 : 4} />
    </div>
  );
}
