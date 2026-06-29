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
        margin: 1,
        errorCorrectionLevel: "M",
        width: size,
        color: { dark: "#031C4D", light: "#ffffff" },
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
        margin: 1,
        errorCorrectionLevel: "M",
        width: 800,
        color: { dark: "#031C4D", light: "#ffffff" },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${name}.png`;
      a.click();
    },
    [value, name],
  );
}
