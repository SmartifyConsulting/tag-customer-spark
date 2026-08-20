import { Link } from "@tanstack/react-router";
import { QrPreview } from "@/components/qr/qr-preview";

// Tag Barcode Reader QR — launches /tools/barcode-reader when scanned (or
// tapped, on the device that's already signed in). Two sizes:
//  - "compact": white rounded frame, used standalone in the sidebar
//  - "micro": a small badge meant to sit right next to the user's avatar
export function TagReaderTile({
  compact = false,
  micro = false,
}: {
  compact?: boolean;
  micro?: boolean;
}) {
  const readerUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tools/barcode-reader`
      : "/tools/barcode-reader";

  if (micro) {
    return (
      <Link
        to="/tools/barcode-reader"
        target="_blank"
        title="Open Tag Barcode Reader"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white p-0.5"
      >
        <QrPreview value={readerUrl} size={24} bare margin={1} />
      </Link>
    );
  }

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
