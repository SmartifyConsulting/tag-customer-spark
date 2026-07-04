import { useMemo } from "react";
import QRCode from "qrcode";
import { useQuery } from "@tanstack/react-query";

export function QrPreview({
  value,
  size = 220,
}: {
  value: string;
  size?: number;
}) {
  const { data } = useQuery({
    queryKey: ["qr-svg", value, size],
    queryFn: () =>
      QRCode.toString(value, {
        type: "svg",
        margin: 4,
        errorCorrectionLevel: "Q",
        width: size,
        color: { dark: "#0A1F5C", light: "#ffffff" },
      }),
    staleTime: Infinity,
  });
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
