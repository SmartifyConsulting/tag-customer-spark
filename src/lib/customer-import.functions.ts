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

// Best-effort normalisation for a phone number that may already include a
// country code, or may need one supplied separately (either from its own
// "country code" column, e.g. "27", or a dial-code hint like "+27").
// Handles the common ERP/POS export shapes:
//   - already E.164: "+27821234567" -> unchanged
//   - digits only, code included: "27821234567" -> "+27821234567"
//   - local format + separate code column: "0821234567" + "27" -> "+27821234567"
//     (leading 0 is the trunk prefix, dropped when a country code is supplied)
function normalisePhone(raw: unknown, countryCodeHint?: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  let digits = s.replace(/\D/g, "");
  if (!digits) return null;

  const hint = String(countryCodeHint ?? "").replace(/\D/g, "");

  if (s.startsWith("+")) {
    return /^\+[1-9]\d{7,14}$/.test(`+${digits}`) ? `+${digits}` : null;
  }

  if (hint) {
    // Number already carries the same code it was exported with once
    // (e.g. phone "0821234567", code "27") — strip the local trunk "0"
    // and prepend the code, rather than concatenating a duplicate.
    const local = digits.startsWith("0") ? digits.slice(1) : digits;
    const combined = digits.startsWith(hint) ? digits : `${hint}${local}`;
    return /^\+[1-9]\d{7,14}$/.test(`+${combined}`) ? `+${combined}` : null;
  }

  // No explicit country code anywhere. A number already 10+ digits is
  // plausibly a full international number missing only its "+"; a shorter
  // local number (e.g. "0821234567") is genuinely ambiguous without a
  // country hint, so it's rejected rather than guessed.
  if (digits.length >= 10) {
    return /^\+[1-9]\d{7,14}$/.test(`+${digits}`) ? `+${digits}` : null;
  }
  return null;
}

function normaliseRow(r: any): CustomerImportRow | null {
  const name =
    (r.full_name ?? "").toString().trim() ||
    [r.first_name, r.last_name].filter(Boolean).map((s: any) => String(s).trim()).join(" ").trim();
  const phone = normalisePhone(r.phone, r.phone_country_code);
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
      `Column headers: ${JSON.stringify(headers)}\nSample rows: ${JSON.stringify(sample)}\n\nReturn JSON: {"map": { canonicalField: sourceHeader }} mapping any of {full_name, first_name, last_name, phone, phone_country_code, email} to the best-matching source header (or null if absent).
Rules:
- If the sheet has one combined name column, map it to full_name.
- If the sheet has separate first/last name columns instead, map those to first_name and last_name (leave full_name null) — do not skip the row for lacking a single full_name column.
- "phone" should match a mobile/cellphone/WhatsApp number column, not a landline.
- If country/dial code is a SEPARATE column from the phone number (e.g. a "27" or "+27" or "Country Code" column), map it to phone_country_code so it can be combined with the local number.`,
      "You map raw spreadsheet columns from a customer/CRM/ERP export to a canonical schema, intelligently handling split name and phone/country-code columns rather than discarding rows that lack a single matching column. Output only valid JSON.",
    );
    const map: Record<string, string | null> = mapping?.map ?? {};
    const get = (row: Record<string, any>, k: string) =>
      map[k] ? row[map[k] as string] : undefined;
    const mapped = rawRows
      .map((row) =>
        normaliseRow({
          full_name: get(row, "full_name"),
          first_name: get(row, "first_name"),
          last_name: get(row, "last_name"),
          phone: get(row, "phone"),
          phone_country_code: get(row, "phone_country_code"),
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
