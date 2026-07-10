import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rowSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  gtin: z.string().optional().nullable(),
  barcode_type: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  category_name: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  price_cents: z.number().int().min(0).default(0),
  sale_price_cents: z.number().int().min(0).optional().nullable(),
  stock_qty: z.number().int().min(0).default(0),
  currency: z.string().length(3).default("ZAR"),
});
export type ImportRow = z.infer<typeof rowSchema>;

async function resolveRetailerId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("retailer_id")
    .eq("user_id", userId)
    .not("retailer_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data?.retailer_id as string | null;
}

function detectBarcodeType(code: string | null | undefined): string | null {
  if (!code) return null;
  const s = code.replace(/\D/g, "");
  if (s.length === 8) return "EAN-8";
  if (s.length === 12) return "UPC-A";
  if (s.length === 13) return "EAN-13";
  if (s.length === 14) return "GTIN-14";
  return null;
}

function toGtin14(code: string | null | undefined): string | null {
  if (!code) return null;
  const s = code.replace(/\D/g, "");
  if (s.length !== 8 && s.length !== 12 && s.length !== 13 && s.length !== 14) return null;
  return s.padStart(14, "0");
}

function priceToCents(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""));
  if (!isFinite(n)) return 0;
  return Math.round(n * 100);
}

async function callAiJson(prompt: string, systemPrompt: string, filePart?: { mime: string; base64: string; filename: string }) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const content: any[] = [{ type: "text", text: prompt }];
  if (filePart) {
    content.push({
      type: "file",
      file: { filename: filePart.filename, file_data: `data:${filePart.mime};base64,${filePart.base64}` },
    });
  }
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "Lovable-API-Key": key },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content },
      ],
    }),
  });
  if (!res.ok) throw new Error(`AI request failed [${res.status}]: ${await res.text()}`);
  const json = await res.json();
  const text = json?.choices?.[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export const previewProductImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        filename: z.string().min(1),
        mime: z.string().min(1),
        base64: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const isPdf = data.mime.includes("pdf") || data.filename.toLowerCase().endsWith(".pdf");
    let rawRows: Record<string, any>[] = [];
    let headers: string[] = [];

    if (!isPdf) {
      const XLSX = await import("xlsx");
      const buf = Buffer.from(data.base64, "base64");
      const wb = XLSX.read(buf, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, any>[];
      headers = rawRows.length ? Object.keys(rawRows[0]) : [];
    }

    // Ask AI to map to canonical fields
    let mapped: ImportRow[] = [];
    if (isPdf) {
      const result = await callAiJson(
        "Extract every product from the attached PDF. Return JSON like {\"rows\":[{...}]} where each row has: name, sku, gtin (barcode digits only), brand, description, category_name, color, size, price (as number, ZAR), sale_price (optional), stock (integer). If SKU is missing, use the GTIN as SKU. Preserve barcode identifiers exactly.",
        "You are a product-catalogue extraction assistant. Output only valid JSON.",
        { mime: data.mime, base64: data.base64, filename: data.filename },
      );
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      mapped = rows
        .map((r: any) => normaliseRow(r))
        .filter((r: ImportRow | null): r is ImportRow => r !== null);
    } else {
      // Ask AI to produce a header mapping
      const sample = rawRows.slice(0, 5);
      const mapping = await callAiJson(
        `Column headers: ${JSON.stringify(headers)}\nSample rows: ${JSON.stringify(sample)}\n\nReturn JSON: {"map": { canonicalField: sourceHeader }} mapping any of {name, sku, gtin, brand, description, category_name, color, size, price, sale_price, stock, currency} to the best-matching source header (or null if absent).`,
        "You map raw spreadsheet columns to a canonical product schema. Output only valid JSON.",
      );
      const map: Record<string, string | null> = mapping?.map ?? {};
      mapped = rawRows
        .map((row) => {
          const get = (k: string) => (map[k] ? row[map[k] as string] : undefined);
          return normaliseRow({
            name: get("name"),
            sku: get("sku"),
            gtin: get("gtin"),
            brand: get("brand"),
            description: get("description"),
            category_name: get("category_name"),
            color: get("color"),
            size: get("size"),
            price: get("price"),
            sale_price: get("sale_price"),
            stock: get("stock"),
            currency: get("currency"),
          });
        })
        .filter((r: ImportRow | null): r is ImportRow => r !== null);
    }

    return { rows: mapped, count: mapped.length, headers };
  });

function normaliseRow(r: any): ImportRow | null {
  const gtinRaw = r.gtin ?? r.barcode ?? r.ean ?? null;
  const gtin = toGtin14(gtinRaw);
  const skuRaw = (r.sku ?? "").toString().trim();
  const sku = skuRaw || (gtin ?? "");
  const name = (r.name ?? "").toString().trim();
  if (!name || !sku) return null;
  const parsed = rowSchema.safeParse({
    name,
    sku,
    gtin,
    barcode_type: detectBarcodeType(gtinRaw),
    brand: r.brand ? String(r.brand) : null,
    description: r.description ? String(r.description) : null,
    category_name: r.category_name ? String(r.category_name) : null,
    color: r.color ? String(r.color) : null,
    size: r.size ? String(r.size) : null,
    price_cents: priceToCents(r.price ?? r.price_cents ?? 0),
    sale_price_cents: r.sale_price != null ? priceToCents(r.sale_price) : null,
    stock_qty: Number(r.stock ?? r.stock_qty ?? 0) || 0,
    currency: (r.currency ? String(r.currency) : "ZAR").toUpperCase().slice(0, 3),
  });
  return parsed.success ? parsed.data : null;
}

export const commitProductImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ rows: z.array(rowSchema).min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer assigned");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const QRCode = (await import("qrcode")).default;
    const { PDFDocument, StandardFonts } = await import("pdf-lib");

    // Preload categories
    const { data: cats } = await supabase
      .from("product_categories")
      .select("id, name")
      .eq("retailer_id", retailerId);
    const catByName = new Map<string, string>();
    (cats ?? []).forEach((c: any) => catByName.set(c.name.toLowerCase(), c.id));

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of data.rows) {
      try {
        let categoryId: string | null = null;
        if (row.category_name) {
          const key = row.category_name.toLowerCase();
          if (catByName.has(key)) categoryId = catByName.get(key)!;
          else {
            const { data: newCat } = await supabase
              .from("product_categories")
              .insert({ retailer_id: retailerId, name: row.category_name })
              .select("id")
              .single();
            if (newCat) {
              categoryId = newCat.id;
              catByName.set(key, newCat.id);
            }
          }
        }

        // Canonical GS1 Digital Link (AI 01) — POS scanners parse the
        // /01/{gtin} segment identically to a linear-barcode scan.
        const canonicalGs1 = row.gtin ? `https://id.gs1.org/01/${row.gtin}` : null;
        // Our resolver URL: same GS1 structure, but points to TAG so
        // consumer scans land on the Digital Product Passport.
        const { resolverUrlForGtin } = await import("./passport.server");
        const digitalLink = row.gtin ? resolverUrlForGtin(row.gtin) : null;

        // Upsert product by (retailer, sku)
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("retailer_id", retailerId)
          .eq("sku", row.sku)
          .maybeSingle();

        const payload: any = {
          retailer_id: retailerId,
          created_by: userId,
          name: row.name,
          sku: row.sku,
          brand: row.brand,
          description: row.description,
          category_id: categoryId,
          color: row.color,
          size: row.size,
          price_cents: row.price_cents,
          sale_price_cents: row.sale_price_cents ?? null,
          currency: row.currency,
          stock_qty: row.stock_qty,
          gtin: row.gtin,
          barcode_type: row.barcode_type,
          digital_link_url: digitalLink,
          status: "active",
        };

        let productId: string;
        if (existing) {
          const { error } = await supabase
            .from("products")
            .update(payload)
            .eq("id", existing.id);
          if (error) throw new Error(error.message);
          productId = existing.id;
          updated++;
        } else {
          const { data: inserted, error } = await supabase
            .from("products")
            .insert(payload)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          productId = inserted.id;
          created++;
        }

        // Generate QR artifacts if we have a digital link
        if (digitalLink) {
          const png = await QRCode.toBuffer(digitalLink, {
            errorCorrectionLevel: "Q",
            margin: 4,
            width: 800,
            color: { dark: "#0A1F5C", light: "#ffffff" },
          });
          const svg = await QRCode.toString(digitalLink, {
            type: "svg",
            errorCorrectionLevel: "Q",
            margin: 4,
            width: 800,
            color: { dark: "#0A1F5C", light: "#ffffff" },
          });
          const pdf = await PDFDocument.create();
          const page = pdf.addPage([420, 520]);
          const font = await pdf.embedFont(StandardFonts.HelveticaBold);
          const body = await pdf.embedFont(StandardFonts.Helvetica);
          const pngImg = await pdf.embedPng(png);
          page.drawImage(pngImg, { x: 60, y: 140, width: 300, height: 300 });
          page.drawText(row.name.slice(0, 40), { x: 60, y: 100, size: 14, font });
          page.drawText(`SKU: ${row.sku}`, { x: 60, y: 80, size: 10, font: body });
          page.drawText(`GTIN: ${row.gtin ?? "—"}`, { x: 60, y: 65, size: 10, font: body });
          page.drawText(digitalLink, { x: 60, y: 50, size: 8, font: body });
          const pdfBytes = await pdf.save();

          const base = `${retailerId}/${productId}/${row.gtin}`;
          const pngPath = `${base}.png`;
          const svgPath = `${base}.svg`;
          const pdfPath = `${base}.pdf`;
          await supabaseAdmin.storage.from("qr-artifacts").upload(pngPath, png, {
            contentType: "image/png",
            upsert: true,
          });
          await supabaseAdmin.storage.from("qr-artifacts").upload(svgPath, new Blob([svg], { type: "image/svg+xml" }), {
            contentType: "image/svg+xml",
            upsert: true,
          });
          await supabaseAdmin.storage.from("qr-artifacts").upload(pdfPath, pdfBytes, {
            contentType: "application/pdf",
            upsert: true,
          });

          await supabase.from("product_qr_assets").insert({
            retailer_id: retailerId,
            product_id: productId,
            gtin: row.gtin,
            digital_link_url: digitalLink,
            png_path: pngPath,
            svg_path: svgPath,
            pdf_path: pdfPath,
            created_by: userId,
          });
        }
      } catch (e: any) {
        failed++;
        errors.push(`${row.sku}: ${e.message ?? "unknown error"}`);
      }
    }

    return { created, updated, failed, errors };
  });
