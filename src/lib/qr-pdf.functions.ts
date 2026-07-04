import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TEMPLATES = ["classic", "minimal", "bold", "compact"] as const;

export const renderQrPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        productIds: z.array(z.string().uuid()).min(1).max(200),
        template: z.enum(TEMPLATES).optional().default("classic"),
        perPage: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]).default(4),
        message: z
          .string()
          .max(160)
          .optional()
          .default(
            "Love this item? Scan here to receive WhatsApp updates if the price drops.",
          ),
        scanBaseUrl: z.string().url(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
    const QRCode = (await import("qrcode")).default;

    // load product + qr details
    const { data: products, error } = await context.supabase
      .from("products")
      .select(
        "id, name, sku, image_url, images, retailer:retailers(name, logo_url), qr_tags(short_code,is_active)",
      )
      .in("id", data.productIds);
    if (error) throw new Error(error.message);
    if (!products?.length) throw new Error("No products found");

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    // A4 in points
    const A4 = { w: 595.28, h: 841.89 };
    const margin = 28;
    const cols = data.perPage === 1 ? 1 : data.perPage === 2 ? 1 : 2;
    const rows = data.perPage === 1 ? 1 : data.perPage === 2 ? 2 : data.perPage === 4 ? 2 : 4;
    const cellW = (A4.w - margin * 2) / cols;
    const cellH = (A4.h - margin * 2) / rows;

    const navy = rgb(3 / 255, 28 / 255, 77 / 255);
    const gray = rgb(0.35, 0.35, 0.4);
    const lightBg = rgb(0.97, 0.97, 0.98);

    async function embedFromUrl(url: string) {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const buf = new Uint8Array(await res.arrayBuffer());
        const ct = res.headers.get("content-type") ?? "";
        if (ct.includes("png")) return await doc.embedPng(buf);
        return await doc.embedJpg(buf);
      } catch {
        return null;
      }
    }

    let page = doc.addPage([A4.w, A4.h]);
    let slot = 0;

    for (const p of products as any[]) {
      const activeTag = (p.qr_tags ?? []).find((t: any) => t.is_active);
      if (!activeTag) continue;

      if (slot >= cols * rows) {
        page = doc.addPage([A4.w, A4.h]);
        slot = 0;
      }
      const col = slot % cols;
      const row = Math.floor(slot / cols);
      const x = margin + col * cellW;
      const y = A4.h - margin - (row + 1) * cellH;
      const pad = 14;
      const cardX = x + pad / 2;
      const cardY = y + pad / 2;
      const cardW = cellW - pad;
      const cardH = cellH - pad;

      // card bg
      page.drawRectangle({
        x: cardX,
        y: cardY,
        width: cardW,
        height: cardH,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.88, 0.88, 0.92),
        borderWidth: 1,
      });

      const isMinimal = data.template === "minimal";
      const isBold = data.template === "bold";
      const isCompact = data.template === "compact";

      // accent strip
      if (!isMinimal) {
        page.drawRectangle({
          x: cardX,
          y: cardY + cardH - 6,
          width: cardW,
          height: 6,
          color: isBold ? rgb(0.13, 0.7, 0.45) : navy,
        });
      }

      // retailer logo top-left
      const logoH = 18;
      let cursorX = cardX + 14;
      const cursorTopY = cardY + cardH - 14 - logoH;
      if (p.retailer?.logo_url) {
        const logo = await embedFromUrl(p.retailer.logo_url);
        if (logo) {
          const ratio = logo.width / logo.height;
          page.drawImage(logo, {
            x: cursorX,
            y: cursorTopY,
            width: logoH * ratio,
            height: logoH,
          });
        }
      } else {
        page.drawText(p.retailer?.name ?? "Tag", {
          x: cursorX,
          y: cursorTopY + 4,
          size: 11,
          font: fontBold,
          color: navy,
        });
      }

      // product image (left) & QR (right)
      const bodyY = cardY + 60;
      const bodyH = cursorTopY - bodyY - 12;
      const imgUrl =
        (p.images?.[0]?.url as string | undefined) ?? p.image_url ?? null;
      const qrSize = Math.min(bodyH, isCompact ? 110 : 150);
      const imgW = Math.min(cardW * 0.42, bodyH);
      const imgX = cardX + 14;
      const imgY = bodyY + (bodyH - imgW) / 2;

      if (imgUrl) {
        const img = await embedFromUrl(imgUrl);
        if (img) {
          page.drawRectangle({
            x: imgX - 4,
            y: imgY - 4,
            width: imgW + 8,
            height: imgW + 8,
            color: lightBg,
          });
          page.drawImage(img, { x: imgX, y: imgY, width: imgW, height: imgW });
        }
      }

      // QR code drawn as rectangles using qrcode matrix
      const qrUrl = `${data.scanBaseUrl}/${activeTag.short_code}`;
      const qr = QRCode.create(qrUrl, { errorCorrectionLevel: "Q" });
      const modules = qr.modules;
      const size = modules.size;
      const cell = qrSize / size;
      const qrX = cardX + cardW - qrSize - 14;
      const qrY = bodyY + (bodyH - qrSize) / 2;
      page.drawRectangle({
        x: qrX - 6,
        y: qrY - 6,
        width: qrSize + 12,
        height: qrSize + 12,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.88, 0.88, 0.92),
        borderWidth: 1,
      });
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (modules.get(r, c)) {
            page.drawRectangle({
              x: qrX + c * cell,
              y: qrY + (size - 1 - r) * cell,
              width: cell + 0.4,
              height: cell + 0.4,
              color: rgb(0, 0, 0),
            });
          }
        }
      }

      // product name + message
      const textX = cardX + 14;
      const titleY = cardY + 38;
      page.drawText(p.name.slice(0, 60), {
        x: textX,
        y: titleY,
        size: 13,
        font: fontBold,
        color: navy,
      });

      const msg = data.message;
      const wrapped = wrapText(msg, font, 10, cardW - 28);
      let my = cardY + 22;
      for (const line of wrapped.slice(0, 2)) {
        page.drawText(line, { x: textX, y: my, size: 10, font, color: gray });
        my -= 12;
      }

      page.drawText(`/${activeTag.short_code}`, {
        x: cardX + cardW - 70,
        y: cardY + 10,
        size: 8,
        font,
        color: gray,
      });

      slot++;
    }

    const bytes = await doc.save();
    // base64 for transport
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    const base64 = btoa(bin);
    return { base64, filename: `tag-qr-${Date.now()}.pdf` };
  });

function wrapText(text: string, font: any, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    const width = font.widthOfTextAtSize(next, size);
    if (width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
