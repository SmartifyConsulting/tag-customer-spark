// Export helpers shared by the receipt wallet and the insurance/household
// inventory export. Everything runs client-side off already-fetched rows.

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join(
    "\n",
  );
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), filename);
}

export async function exportExcel(rows: Record<string, unknown>[], filename: string, sheet = "Sheet1") {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename,
  );
}

export async function exportTablePdf(
  title: string,
  rows: Record<string, unknown>[],
  filename: string,
) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(16);
  doc.text(title, 40, 40);
  doc.setFontSize(9);
  let y = 70;
  if (rows.length) {
    const headers = Object.keys(rows[0]!);
    doc.text(headers.join("  |  ").slice(0, 200), 40, y);
    y += 14;
    for (const r of rows) {
      const line = headers.map((h) => String(r[h] ?? "")).join("  |  ");
      doc.text(line.slice(0, 200), 40, y);
      y += 12;
      if (y > 540) {
        doc.addPage();
        y = 50;
      }
    }
  }
  doc.save(filename);
}

export async function exportReceiptPdf(receipt: {
  receiptNumber: string;
  storeName: string;
  date: string;
  paymentMethod?: string | null;
  currency: string;
  totalCents: number;
  items: { name: string; quantity: number; lineTotalCents: number }[];
}) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a5" });
  const money = (c: number) => `${receipt.currency} ${(c / 100).toFixed(2)}`;
  doc.setFontSize(15);
  doc.text(receipt.storeName, 40, 50);
  doc.setFontSize(10);
  doc.text(`Receipt ${receipt.receiptNumber}`, 40, 70);
  doc.text(new Date(receipt.date).toLocaleString(), 40, 85);
  if (receipt.paymentMethod) doc.text(receipt.paymentMethod, 40, 100);
  let y = 130;
  for (const i of receipt.items) {
    doc.text(`${i.quantity} x ${i.name}`.slice(0, 48), 40, y);
    doc.text(money(i.lineTotalCents), 300, y, { align: "right" });
    y += 16;
  }
  y += 10;
  doc.setFontSize(12);
  doc.text("Total", 40, y);
  doc.text(money(receipt.totalCents), 300, y, { align: "right" });
  doc.save(`${receipt.receiptNumber}.pdf`);
}

export function printElement(html: string, title: string) {
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return;
  w.document.write(
    `<html><head><title>${title}</title><style>body{font-family:ui-sans-serif,system-ui;padding:24px;color:#0A1F5C}table{width:100%;border-collapse:collapse}td{padding:4px 0}</style></head><body>${html}</body></html>`,
  );
  w.document.close();
  w.focus();
  w.print();
}

export async function shareText(title: string, text: string) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch {
      return false;
    }
  }
  await navigator.clipboard.writeText(text);
  return true;
}
