import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rowSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
  manager_name: z.string().optional().nullable(),
  contact_phone: z.string().optional().nullable(),
});
export type StoreImportRow = z.infer<typeof rowSchema>;

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

function normaliseRow(r: any): StoreImportRow | null {
  const name = (r.name ?? "").toString().trim();
  if (!name) return null;
  const parsed = rowSchema.safeParse({
    name,
    address: r.address ? String(r.address) : null,
    city: r.city ? String(r.city) : null,
    country: r.country ? String(r.country) : null,
    timezone: r.timezone ? String(r.timezone) : null,
    manager_name: r.manager_name ? String(r.manager_name) : null,
    contact_phone: r.contact_phone ? String(r.contact_phone) : null,
  });
  return parsed.success ? parsed.data : null;
}

// Same shape as previewProductImport: spreadsheet in, AI maps headers to a
// canonical schema, we return normalised rows for the user to review before
// committing. ERP branch/site/plant exports are the usual source (see
// import.functions.ts's store_name field for the equivalent on the product
// import side) — this is for a dedicated stores file instead.
export const previewStoreImport = createServerFn({ method: "POST" })
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
    const { callAiJson } = await import("./import.functions");
    let mapped: StoreImportRow[] = [];
    let headers: string[] = [];

    if (isPdf) {
      const result = await callAiJson(
        'Extract every store/branch/site from the attached document. Return JSON like {"rows":[{...}]} where each row has: name (branch/store/site/plant name or code), address, city, country, timezone (IANA tz if determinable from city/country, else null), manager_name, contact_phone.',
        "You are a retail branch-master extraction assistant. Output only valid JSON.",
        { mime: data.mime, base64: data.base64, filename: data.filename },
      );
      const rows = Array.isArray(result?.rows) ? result.rows : [];
      mapped = rows
        .map((r: any) => normaliseRow(r))
        .filter((r: StoreImportRow | null): r is StoreImportRow => r !== null);
    } else {
      const XLSX = await import("xlsx");
      const buf = Buffer.from(data.base64, "base64");
      const wb = XLSX.read(buf, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, any>[];
      headers = rawRows.length ? Object.keys(rawRows[0]) : [];
      const sample = rawRows.slice(0, 5);
      const mapping = await callAiJson(
        `Column headers: ${JSON.stringify(headers)}\nSample rows: ${JSON.stringify(sample)}\n\nReturn JSON: {"map": { canonicalField: sourceHeader }} mapping any of {name, address, city, country, timezone, manager_name, contact_phone} to the best-matching source header (or null if absent). "name" covers ERP branch/site/plant/location/warehouse code or name columns (e.g. SAP plant code, Oracle inventory org, Dynamics warehouse, a POS store master column).`,
        "You map raw spreadsheet columns to a canonical store/branch schema. Output only valid JSON.",
      );
      const map: Record<string, string | null> = mapping?.map ?? {};
      mapped = rawRows
        .map((row) => {
          const get = (k: string) => (map[k] ? row[map[k] as string] : undefined);
          return normaliseRow({
            name: get("name"),
            address: get("address"),
            city: get("city"),
            country: get("country"),
            timezone: get("timezone"),
            manager_name: get("manager_name"),
            contact_phone: get("contact_phone"),
          });
        })
        .filter((r: StoreImportRow | null): r is StoreImportRow => r !== null);
    }

    return { rows: mapped, count: mapped.length, headers };
  });

export const commitStoreImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rows: z.array(rowSchema).min(1).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer assigned");

    const { data: existingRows } = await supabase
      .from("stores")
      .select("id, name")
      .eq("retailer_id", retailerId);
    const byName = new Map<string, string>(
      (existingRows ?? []).map((s: any) => [s.name.toLowerCase(), s.id]),
    );

    let created = 0;
    let updated = 0;
    const errors: string[] = [];

    for (const row of data.rows) {
      try {
        const key = row.name.toLowerCase();
        const existingId = byName.get(key);
        const payload: any = {
          name: row.name,
          address: row.address ?? null,
          city: row.city ?? null,
          country: row.country ?? null,
          timezone: row.timezone ?? null,
          manager_name: row.manager_name ?? null,
          contact_phone: row.contact_phone ?? null,
        };
        if (existingId) {
          const { error } = await supabase.from("stores").update(payload).eq("id", existingId);
          if (error) throw new Error(error.message);
          updated++;
        } else {
          const { data: ins, error } = await supabase
            .from("stores")
            .insert({ ...payload, retailer_id: retailerId, created_by: userId, status: "active" } as any)
            .select("id")
            .single();
          if (error) throw new Error(error.message);
          if (ins) byName.set(key, ins.id);
          created++;
        }
      } catch (e: any) {
        errors.push(`${row.name}: ${e?.message ?? "unknown error"}`);
      }
    }

    return { created, updated, errors };
  });
