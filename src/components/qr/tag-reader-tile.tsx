import { QrPreview } from "@/components/qr/qr-preview";

// Compact Tag Barcode Reader QR tile — sits at the bottom of the left nav
// panel, just above the search bar. White rounded frame, matching the Tag
// logo's own white card treatment at the top of the sidebar, and sized to
// match the logo's overall footprint (11.34rem).
export function TagReaderTile({ compact = false }: { compact?: boolean }) {
  const readerUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tools/barcode-reader`
      : "/tools/barcode-reader";

  return (
    <div
      className={`flex items-center justify-center rounded-2xl bg-white ${
        compact ? "h-[11.34rem] w-[11.34rem] p-2" : "p-5"
      }`}
    >
      <QrPreview value={readerUrl} size={compact ? 141 : 192} bare />
    </div>
  );
}
