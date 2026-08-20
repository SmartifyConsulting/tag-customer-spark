import { Link } from "@tanstack/react-router";
import { QrPreview } from "@/components/qr/qr-preview";

export function readerUrl() {
  return typeof window !== "undefined"
    ? `${window.location.origin}/tools/barcode-reader`
    : "/tools/barcode-reader";
}

// Square (no rounding — corners matter for scan reliability), no extra
// frame/padding beyond the plain white background a QR needs for contrast.
// Sized to actually be scannable, unlike a tiny rounded badge. Meant to
// stand in for the user's avatar (see UserMenu) — no Link wrapper, since
// it's embedded inside that button, which is already clickable.
export function TagReaderQrBadge({ size = 36 }: { size?: number }) {
  return (
    <div className="flex shrink-0 items-center justify-center bg-white" style={{ height: size, width: size }}>
      <QrPreview value={readerUrl()} size={size} bare margin={1} />
    </div>
  );
}

// Tag Barcode Reader QR — launches /tools/barcode-reader when scanned (or
// tapped, on the device that's already signed in). Two sizes:
//  - "compact": white rounded frame, used standalone in the sidebar
//  - "micro": a small clickable badge (own Link, for standalone placement)
export function TagReaderTile({
  compact = false,
  micro = false,
}: {
  compact?: boolean;
  micro?: boolean;
}) {
  const url = readerUrl();

  if (micro) {
    return (
      <Link
        to="/tools/barcode-reader"
        target="_blank"
        title="Open Tag Barcode Reader"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white p-0.5"
      >
        <QrPreview value={url} size={24} bare margin={1} />
      </Link>
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-2xl bg-white ${
        compact ? "h-[11rem] w-[11rem] p-2" : "p-5"
      }`}
    >
      <QrPreview value={url} size={compact ? 160 : 192} bare margin={compact ? 2 : 4} />
    </div>
  );
}
