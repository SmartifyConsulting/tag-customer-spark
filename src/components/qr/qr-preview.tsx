import { useMemo } from "react";
import QRCode from "qrcode";
import { useQuery } from "@tanstack/react-query";

export function QrPreview({
  value,
  size = 220,
  // Skip the white card/border wrapper — used when a caller wants to place
  // its own content (e.g. a label) inside a single shared white box with
  // the QR code, rather than getting a self-contained white tile.
  bare = false,
  // Module colors — defaults to navy-on-white. Callers on a dark background
  // (e.g. the sidebar) can invert to white-on-navy.
  darkColor = "#0A1F5C",
  lightColor = "#ffffff",
  // Quiet-zone width in QR *modules* (not px), baked into the SVG itself by
  // the qrcode library. 4 is the spec-safe default; a caller placing the
  // code in a tight decorative frame can go lower (2 is still generally
  // scannable) to shrink the white margin around the dark modules.
  margin = 4,
}: {
  value: string;
  size?: number;
  bare?: boolean;
  darkColor?: string;
  lightColor?: string;
  margin?: number;
}) {
  const { data } = useQuery({
    queryKey: ["qr-svg", value, size, darkColor, lightColor, margin],
    queryFn: () =>
      QRCode.toString(value, {
        type: "svg",
        margin,
        errorCorrectionLevel: "Q",
        width: size,
        color: { dark: darkColor, light: lightColor },
      }),
    staleTime: Infinity,
  });
  if (bare) {
    // No extra breathing room beyond the SVG's own baked-in quiet zone —
    // the SVG is already `size` px square including that margin.
    return (
      <div
        className="grid place-items-center"
        style={{ width: size, height: size }}
        dangerouslySetInnerHTML={{ __html: data ?? "" }}
      />
    );
  }
  return (
    <div
      className="grid place-items-center rounded-xl border border-border bg-white p-3"
      style={{ width: size + 24, height: size + 24 }}
      dangerouslySetInnerHTML={{ __html: data ?? "" }}
    />
  );
}

export function useQrPngDownload(value: string, name: string) {
  return useMemo(
    () => async () => {
      const dataUrl = await QRCode.toDataURL(value, {
        margin: 4,
        errorCorrectionLevel: "Q",
        width: 800,
        color: { dark: "#0A1F5C", light: "#ffffff" },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${name}.png`;
      a.click();
    },
    [value, name],
  );
}
