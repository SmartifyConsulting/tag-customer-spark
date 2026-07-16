import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAiJson } from "./import.functions";

const customerRowSchema = z.object({
  full_name: z.string().trim().min(1),
  whatsapp_e164: z.string().trim().min(8),
  email: z.string().trim().optional().nullable(),
});
export type CustomerImportRow = z.infer<typeof customerRowSchema>;

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

// Best-effort normalisation only — an ERP/CRM export's phone column can be
// in almost any local format. We don't guess a country code; a number that
// doesn't already look like international format (leading +) is rejected
// rather than silently mis-tagged with the wrong country.
function normalisePhone(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const hasPlus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  const withPlus = hasPlus ? `+${digits}` : `+${digits}`;
  return /^\+[1-9]\d{7,14}$/.test(withPlus) ? withPlus : null;
}

function normaliseRow(r: any): CustomerImportRow | null {
  const name = (r.full_name ?? "").toString().trim();
  const phone = normalisePhone(r.phone);
  if (!name || !phone) return null;
  const parsed = customerRowSchema.safeParse({
    full_name: name,
    whatsapp_e164: phone,
    email: r.email ? String(r.email) : null,
  });
  return parsed.success ? parsed.data : null;
}

// Mirrors previewProductImport/commitProductImport (import.functions.ts):
// AI-assisted column mapping for an arbitrary spreadsheet export, so a
// retailer's ERP/POS customer export can be dropped in directly instead of
// requiring a specific template — same "direct the user to the relevant
// export" pattern already used for products.
export const previewCustomerImport = createServerFn({ method: "POST" })
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
    const XLSX = await import("xlsx");
    const buf = Buffer.from(data.base64, "base64");
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, any>[];
    const headers = rawRows.length ? Object.keys(rawRows[0]) : [];

    const sample = rawRows.slice(0, 5);
    const mapping = await callAiJson(
      `Column headers: ${JSON.stringify(headers)}\nSample rows: ${JSON.stringify(sample)}\n\nReturn JSON: {"map": { canonicalField: sourceHeader }} mapping any of {full_name, phone, email} to the best-matching source header (or null if absent). "phone" should match a mobile/cellphone/WhatsApp number column, not a landline.`,
      "You map raw spreadsheet columns from a customer/CRM/ERP export to a canonical schema. Output only valid JSON.",
    );
    const map: Record<string, string | null> = mapping?.map ?? {};
    const get = (row: Record<string, any>, k: string) =>
      map[k] ? row[map[k] as string] : undefined;
    const mapped = rawRows
      .map((row) =>
        normaliseRow({
          full_name: get(row, "full_name"),
          phone: get(row, "phone"),
          email: get(row, "email"),
        }),
      )
      .filter((r): r is CustomerImportRow => r !== null);

    return {
      rows: mapped,
      count: mapped.length,
      skipped: rawRows.length - mapped.length,
      headers,
    };
  });

export const commitCustomerImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ rows: z.array(customerRowSchema).min(1).max(2000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer assigned");

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of data.rows) {
      try {
        const { data: existing } = await supabase
          .from("customers")
          .select("id")
          .eq("retailer_id", retailerId)
          .eq("whatsapp_e164", row.whatsapp_e164)
          .maybeSingle();

        const payload: any = {
          retailer_id: retailerId,
          full_name: row.full_name,
          whatsapp_e164: row.whatsapp_e164,
          email: row.email || null,
        };

        if (existing) {
          const { error } = await supabase.from("customers").update(payload).eq("id", existing.id);
          if (error) throw new Error(error.message);
          updated++;
        } else {
          const now = new Date().toISOString();
          const { error } = await supabase.from("customers").insert({
            ...payload,
            // Imported from the retailer's own system, not a QR opt-in — so
            // "registered", not "subscribed": we have no proof of marketing
            // consent, only that they're a real, known customer.
            status: "registered",
            opted_in_at: now,
            notify_consent_at: now,
          });
          if (error) throw new Error(error.message);
          created++;
        }
      } catch (e: any) {
        failed++;
        errors.push(`${row.full_name} (${row.whatsapp_e164}): ${e.message ?? "unknown error"}`);
      }
    }

    return { created, updated, failed, errors };
  });
