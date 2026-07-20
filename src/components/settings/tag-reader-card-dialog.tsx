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

// Fold-out shelf card: A4 portrait, single-side print. Two identical
// panels stacked vertically with a faint dashed fold line down the middle
// so it can be folded in half (crease at top) to stand on a shelf as a
// tent card, or trimmed at the fold for a flat card. Sending to a
// professional printer for duplex tent-card printing also works because
// both faces of the sheet are ready-made.
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

      // Dark background across the whole sheet
      doc.setFillColor(20, 24, 33);
      doc.rect(0, 0, W, H, "F");

      // Draw one face centered on a panel (upright)
      const drawFace = (panelTop: number, panelH: number) => {
        const cx = W / 2;
        const top = panelTop + 14;

        if (logoDataUrl) {
          const lw = 70;
          const lh = 26;
          doc.addImage(logoDataUrl, "PNG", cx - lw / 2, top, lw, lh);
        }

        doc.setTextColor(255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.text("SCAN THE QR CODE", cx, top + 44, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.text("USING YOUR PHONE CAMERA", cx, top + 54, { align: "center" });

        // QR with yellow frame accent
        const qrSize = 76;
        const qx = cx - qrSize / 2;
        const qy = top + 66;
        doc.setFillColor(255, 200, 40);
        doc.roundedRect(qx - 5, qy - 5, qrSize + 10, qrSize + 10, 3, 3, "F");
        doc.setFillColor(255, 255, 255);
        doc.rect(qx - 1, qy - 1, qrSize + 2, qrSize + 2, "F");
        if (qrDataUrl) {
          doc.addImage(qrDataUrl, "PNG", qx, qy, qrSize, qrSize);
        }

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(220);
        doc.text(
          readerUrl.replace(/^https?:\/\//, ""),
          cx,
          Math.min(panelTop + panelH - 8, qy + qrSize + 12),
          { align: "center" },
        );
      };

      drawFace(0, mid);
      drawFace(mid, mid);

      // Fold guide across the middle
      doc.setDrawColor(210);
      doc.setLineDashPattern([2.5, 2.5], 0);
      doc.setLineWidth(0.25);
      doc.line(8, mid, W - 8, mid);
      doc.setLineDashPattern([], 0);
      doc.setFontSize(7);
      doc.setTextColor(200);
      doc.text("— fold here —", W / 2, mid - 1.5, { align: "center" });

      doc.save("tag-barcode-reader-card.pdf");
    },
    [qrDataUrl, logoDataUrl, readerUrl],
  );

  const print = () => {
    if (!qrDataUrl || !logoDataUrl) return;
    const w = window.open("", "_blank", "width=820,height=1160");
    if (!w) return;
    const face = `
      <section class="face">
        <img class="logo" src="${logoDataUrl}" alt="Tag" />
        <p class="headline">SCAN THE QR CODE<br/><span>USING YOUR PHONE CAMERA</span></p>
        <div class="qr-frame"><div class="qr-inner"><img src="${qrDataUrl}" alt="QR" /></div></div>
        <p class="url">${readerUrl.replace(/^https?:\/\//, "")}</p>
      </section>`;
    w.document.write(`<!doctype html><html><head><title>Tag Barcode Reader</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        html, body { margin: 0; padding: 0; background: #141821; color: #fff;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
        .sheet { width: 210mm; height: 297mm; display: flex; flex-direction: column;
          box-sizing: border-box; page-break-after: avoid; }
        .face { flex: 1 1 0; display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 6mm; padding: 12mm 10mm; box-sizing: border-box; }
        .logo { height: 22mm; width: auto; object-fit: contain; }
        .headline { margin: 0; text-align: center; font-weight: 800; font-size: 20pt;
          letter-spacing: 0.02em; }
        .headline span { display: block; margin-top: 2mm; font-weight: 400;
          font-size: 10pt; opacity: 0.85; letter-spacing: 0.14em; }
        .qr-frame { background: #FFC828; padding: 3mm; border-radius: 3mm; }
        .qr-inner { background: #fff; padding: 2mm; border-radius: 1.5mm; }
        .qr-inner img { display: block; width: 62mm; height: 62mm; }
        .url { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          font-size: 8pt; opacity: 0.7; }
        .fold { position: relative; height: 0; border-top: 1px dashed rgba(255,255,255,0.5); }
        .fold span { position: absolute; left: 50%; top: 50%;
          transform: translate(-50%, -50%); background: #141821; padding: 0 3mm;
          font-size: 7pt; letter-spacing: 0.3em; text-transform: uppercase;
          color: rgba(255,255,255,0.6); }
      </style></head><body>
      <div class="sheet">${face}<div class="fold"><span>fold</span></div>${face}</div>
      <script>
        window.addEventListener('load', function () {
          setTimeout(function () { window.focus(); window.print(); }, 150);
        });
      </script>
      </body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tag Barcode Reader — shelf card</DialogTitle>
          <DialogDescription>
            Print on A4, fold along the dashed line to stand as a tent card on shelves, or send the PDF to a professional printer.
          </DialogDescription>
        </DialogHeader>

        <div id="tag-reader-print-area" className="mx-auto w-full max-w-[360px]">
          <div className="overflow-hidden rounded-xl bg-[#141821] text-white shadow-lg">
            <CardFace qrDataUrl={qrDataUrl} readerUrl={readerUrl} />
            <div className="relative">
              <div className="border-t border-dashed border-white/40" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#141821] px-2 text-[10px] uppercase tracking-widest text-white/60">
                fold
              </span>
            </div>
            <CardFace qrDataUrl={qrDataUrl} readerUrl={readerUrl} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={print} disabled={!qrDataUrl || !logoDataUrl}>
            <Printer className="mr-2 h-4 w-4" /> Print preview
          </Button>
          <Button onClick={downloadPdf} disabled={!qrDataUrl || !logoDataUrl}>
            <Download className="mr-2 h-4 w-4" /> Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CardFace({ qrDataUrl, readerUrl }: { qrDataUrl: string; readerUrl: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-6">
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
