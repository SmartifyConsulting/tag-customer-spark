import { QrPreview } from "@/components/qr/qr-preview";

// Compact Tag Barcode Reader QR tile — sits at the bottom of the left nav
// panel, just above the search bar. Inverted (white modules, no card) so it
// reads directly against the navy sidebar background.
export function TagReaderTile({ compact = false }: { compact?: boolean }) {
  const readerUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tools/barcode-reader`
      : "/tools/barcode-reader";

  return (
    <QrPreview
      value={readerUrl}
      size={compact ? 144 : 192}
      bare
      darkColor="#FFFFFF"
      lightColor="#18304F"
    />
  );
}
