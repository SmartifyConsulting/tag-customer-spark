import { Link } from "@tanstack/react-router";
import { QrPreview } from "@/components/qr/qr-preview";

export function readerUrl() {
  return typeof window !== "undefined"
    ? `${window.location.origin}/tools/barcode-reader`
    : "/tools/barcode-reader";
}

// No white frame or backing tile — the code is rendered directly on the
// surface using white modules on a transparent background, sized ~2cm
// (76px @96dpi) so it stays comfortably scannable.
export function TagReaderQrBadge({ size = 76 }: { size?: number }) {
  return (
    <QrPreview
      value={readerUrl()}
      size={size}
      bare
      margin={0}
      darkColor="#FFFFFF"
      lightColor="#00000000"
    />
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
