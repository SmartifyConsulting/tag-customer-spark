import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Download, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import tagLogo from "@/assets/Tag_logo_pink_horizontal.png";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  readerUrl: string;
};

// Fold-out shelf card. Designed as a tent card on A4 portrait:
// the sheet is folded in half along the horizontal center; the top
// half prints inverted so that once folded it forms a self-standing
// tent showing the same face front and back.
export function TagReaderCardDialog({ open, onOpenChange, readerUrl }: Props) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [logoDataUrl, setLogoDataUrl] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(readerUrl, {
      margin: 1,
      errorCorrectionLevel: "Q",
      width: 900,
      color: { dark: "#0A1F5C", light: "#ffffff" },
    }).then(setQrDataUrl);
  }, [open, readerUrl]);

  useEffect(() => {
    if (!open || logoDataUrl) return;
    // Convert bundled PNG to a data URL so jsPDF can embed it.
    fetch(tagLogo)
      .then((r) => r.blob())
      .then(
        (b) =>
          new Promise<string>((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result));
            fr.onerror = reject;
            fr.readAsDataURL(b);
          }),
      )
      .then(setLogoDataUrl)
      .catch(() => {});
  }, [open, logoDataUrl]);

  const downloadPdf = useMemo(
    () => async () => {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const W = 210;
      const H = 297;
      const mid = H / 2;

      // Background panels
      doc.setFillColor(20, 24, 33); // near-black
      doc.rect(0, 0, W, H, "F");

      // Fold guide down the middle
      doc.setDrawColor(200);
      doc.setLineDashPattern([2, 2], 0);
      doc.setLineWidth(0.2);
      doc.line(8, mid, W - 8, mid);
      doc.setLineDashPattern([], 0);

      // Small "fold here" label
      doc.setFontSize(7);
      doc.setTextColor(180);
      doc.text("— fold here —", W / 2, mid - 1, { align: "center" });

      // Draw a face (called twice: once upright bottom half, once inverted top half)
      const drawFace = (originY: number, panelH: number, invert: boolean) => {
        const cx = W / 2;
        // Coordinate helper: y relative to the panel's own top when upright.
        const y = (t: number) => (invert ? originY + panelH - t : originY + t);

        // Logo
        if (logoDataUrl) {
          const lw = 70;
          const lh = 28;
          const lx = cx - lw / 2;
          const ly = y(invert ? 18 + lh : 18);
          if (invert) {
            // Rotate 180deg around image center
            doc.addImage(
              logoDataUrl,
              "PNG",
              lx,
              ly,
              lw,
              lh,
              undefined,
              "FAST",
              180,
            );
          } else {
            doc.addImage(logoDataUrl, "PNG", lx, ly, lw, lh);
          }
        }

        // Caption
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(255);
        const cap1 = "SCAN THE QR CODE";
        const cap2 = "USING YOUR PHONE CAMERA";
        drawText(doc, cap1, cx, y(invert ? 60 : 60), invert);
        doc.setFontSize(13);
        doc.setFont("helvetica", "normal");
        drawText(doc, cap2, cx, y(invert ? 70 : 70), invert);

        // QR code with a yellow frame accent
        const qrSize = 78;
        const qx = cx - qrSize / 2;
        const qy = y(invert ? 88 + qrSize : 88);
        doc.setFillColor(255, 200, 40);
        doc.roundedRect(qx - 4, qy - 4, qrSize + 8, qrSize + 8, 2, 2, "F");
        doc.setFillColor(255);
        doc.rect(qx - 1, qy - 1, qrSize + 2, qrSize + 2, "F");
        if (qrDataUrl) {
          doc.addImage(
            qrDataUrl,
            "PNG",
            qx,
            qy,
            qrSize,
            qrSize,
            undefined,
            "FAST",
            invert ? 180 : 0,
          );
        }

        // Footer URL
        doc.setFontSize(9);
        doc.setTextColor(220);
        drawText(doc, readerUrl.replace(/^https?:\/\//, ""), cx, y(invert ? 178 : 178), invert);
      };

      drawFace(0, mid, true); // top half: inverted
      drawFace(mid, mid, false); // bottom half: upright

      doc.save("tag-barcode-reader-card.pdf");
    },
    [qrDataUrl, logoDataUrl, readerUrl],
  );

  const print = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tag Barcode Reader — shelf card</DialogTitle>
          <DialogDescription>
            Fold along the dashed line so it stands as a tent card. Print on A4 or send the PDF to a professional printer.
          </DialogDescription>
        </DialogHeader>

        {/* On-screen preview */}
        <div id="tag-reader-print-area" className="mx-auto w-full max-w-[360px]">
          <div className="relative overflow-hidden rounded-xl bg-[#141821] text-white shadow-lg">
            {/* Top face (inverted) */}
            <CardFace qrDataUrl={qrDataUrl} readerUrl={readerUrl} inverted />
            {/* Fold line */}
            <div className="relative">
              <div className="border-t border-dashed border-white/40" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#141821] px-2 text-[10px] uppercase tracking-widest text-white/60">
                fold
              </span>
            </div>
            {/* Bottom face (upright) */}
            <CardFace qrDataUrl={qrDataUrl} readerUrl={readerUrl} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={print}>
            <Printer className="mr-2 h-4 w-4" /> Print preview
          </Button>
          <Button onClick={downloadPdf} disabled={!qrDataUrl || !logoDataUrl}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Print-only styling: isolate the card when the user hits Print */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #tag-reader-print-area, #tag-reader-print-area * { visibility: visible !important; }
          #tag-reader-print-area { position: fixed; inset: 0; margin: auto; }
        }
      `}</style>
    </Dialog>
  );
}

function CardFace({
  qrDataUrl,
  readerUrl,
  inverted = false,
}: {
  qrDataUrl: string;
  readerUrl: string;
  inverted?: boolean;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 px-6 py-6"
      style={inverted ? { transform: "rotate(180deg)" } : undefined}
    >
      <img src={tagLogo} alt="Tag" className="h-10 w-auto object-contain" />
      <p className="mt-1 text-center text-sm font-bold leading-tight">
        SCAN THE QR CODE
        <br />
        <span className="text-[11px] font-normal opacity-80">USING YOUR PHONE CAMERA</span>
      </p>
      <div className="rounded-md bg-[#FFC828] p-1.5">
        <div className="rounded-sm bg-white p-1">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR" className="h-32 w-32" />
          ) : (
            <div className="h-32 w-32 animate-pulse bg-muted/50" />
          )}
        </div>
      </div>
      <p className="text-[9px] font-mono text-white/70">
        {readerUrl.replace(/^https?:\/\//, "")}
      </p>
    </div>
  );
}

// jsPDF has no rotated-text primitive in v3+ that centers cleanly, so we
// use its angle option and manually offset for 180deg text.
function drawText(
  doc: any,
  text: string,
  x: number,
  y: number,
  invert: boolean,
) {
  if (!invert) {
    doc.text(text, x, y, { align: "center" });
  } else {
    doc.text(text, x, y, { align: "center", angle: 180 });
  }
}
