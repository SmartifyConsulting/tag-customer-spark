import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { QrCode as QrIcon } from "lucide-react";
import { getPublicScanBase } from "@/lib/qr.functions";

export function MiniProductQr({
  shortCode,
  onClick,
}: {
  shortCode: string | null | undefined;
  onClick?: () => void;
}) {
  const baseFn = useServerFn(getPublicScanBase);
  const { data: baseData } = useQuery({
    queryKey: ["public-scan-base"],
    queryFn: () => baseFn(),
    staleTime: Infinity,
  });

  const origin =
    baseData?.base ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const scanUrl = shortCode ? `${origin}/api/public/s/${shortCode}` : "";

  const { data: svg } = useQuery({
    enabled: Boolean(scanUrl),
    queryKey: ["mini-qr-svg", scanUrl],
    queryFn: () =>
      QRCode.toString(scanUrl, {
        type: "svg",
        margin: 4,
        errorCorrectionLevel: "Q",
        width: 64,
        color: { dark: "#0A1F5C", light: "#ffffff" },
      }),
    staleTime: Infinity,
  });

  const label = shortCode
    ? "Open QR code panel"
    : "Generate QR code for this product";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="absolute bottom-2.5 right-2.5 grid h-[76px] w-[76px] place-items-center rounded-md border border-border bg-white p-1.5 shadow-lg transition hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {shortCode && svg ? (
        <div
          className="h-full w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className="grid h-full w-full place-items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          <QrIcon className="h-6 w-6" />
          {!shortCode && <span>Generate</span>}
        </div>
      )}
    </button>
  );
}
