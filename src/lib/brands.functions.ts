import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function resolveRetailerId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("retailer_id")
    .eq("user_id", userId)
    .not("retailer_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data?.retailer_id ?? null;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const brandInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  website: z.preprocess((v) => {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    return /^https?:\/\//i.test(s) ? s : `https://${s}`;
  }, z.string().url().nullable().optional()),
  description: z.string().max(500).nullable().optional(),
});

export const listBrands = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return { rows: [], counts: {} };
    const [{ data: rows }, { data: prods }] = await Promise.all([
      supabase
        .from("brands")
        .select("id, name, slug, logo_url, website, description")
        .eq("retailer_id", retailerId)
        .order("name"),
      supabase
        .from("products")
        .select("brand_id")
        .eq("retailer_id", retailerId)
        .not("brand_id", "is", null),
    ]);
    const counts: Record<string, number> = {};
    for (const p of prods ?? []) if (p.brand_id) counts[p.brand_id] = (counts[p.brand_id] ?? 0) + 1;
    return { rows: rows ?? [], counts };
  });

export const upsertBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => brandInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");
    const slug = slugify(data.name);
    if (data.id) {
      const { error } = await supabase
        .from("brands")
        .update({
          name: data.name,
          slug,
          website: data.website ?? null,
          description: data.description ?? null,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("brands")
      .insert({
        retailer_id: retailerId,
        name: data.name,
        slug,
        website: data.website ?? null,
        description: data.description ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: ins.id };
  });

export const deleteBrand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("brands").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Logo resolution ----------

async function aiGenerateLogo(brandName: string): Promise<Uint8Array | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "openai/gpt-image-1-mini",
        prompt: `Clean, official-style brand wordmark logo for "${brandName}" on a solid white background. Centred, high contrast, no photo, no packaging, no extra graphics.`,
        size: "1024x1024",
        quality: "low",
        n: 1,
      }),
    });
    if (!res.ok) {
      console.error("aiGenerateLogo failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    const j = await res.json();
    const b64 = j?.data?.[0]?.b64_json;
    if (!b64) return null;
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch (e) {
    console.error("aiGenerateLogo threw", e);
    return null;
  }
}

async function tryClearbit(
  website: string | null,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (!website) return null;
  try {
    const domain = new URL(
      website.startsWith("http") ? website : `https://${website}`,
    ).hostname.replace(/^www\./, "");
    const res = await fetch(`https://logo.clearbit.com/${domain}?size=256`);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 200) return null;
    return { bytes: buf, contentType: res.headers.get("content-type") ?? "image/png" };
  } catch {
    return null;
  }
}

// Resolves (Clearbit by website, then AI as a fallback) and caches a logo
// for a brand that doesn't have one yet. Returns the existing logo_url
// unchanged if already set. Shared by the manual "resolve logo" action in
// Brand admin and by product image resolution (see product-images.server.ts),
// so a product can fall back to its brand's logo instead of a generic
// placeholder without duplicating the fetch/upload logic.
export async function ensureBrandLogo(
  supabase: any,
  brand: { id: string; name: string; website: string | null; logo_url?: string | null },
): Promise<string | null> {
  if (brand.logo_url) return brand.logo_url;

  let payload: { bytes: Uint8Array; contentType: string } | null = await tryClearbit(brand.website);
  if (!payload) {
    const bytes = await aiGenerateLogo(brand.name);
    if (bytes) payload = { bytes, contentType: "image/png" };
  }
  if (!payload) return null;

  const ext = payload.contentType.includes("png")
    ? "png"
    : payload.contentType.includes("svg")
      ? "svg"
      : "png";
  const path = `${brand.id}/logo-${Date.now()}.${ext}`;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: upErr } = await supabaseAdmin.storage
    .from("brand-logos")
    .upload(path, payload.bytes, {
      contentType: payload.contentType,
      upsert: true,
    });
  if (upErr) return null;
  const { data: pub } = supabaseAdmin.storage.from("brand-logos").getPublicUrl(path);
  await supabase
    .from("brands")
    .update({ logo_path: path, logo_url: pub.publicUrl })
    .eq("id", brand.id);
  return pub.publicUrl;
}

export const resolveBrandLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: brand } = await supabase
      .from("brands")
      .select("id, name, slug, website, logo_url")
      .eq("id", data.id)
      .maybeSingle();
    if (!brand) throw new Error("Brand not found");

    const url = await ensureBrandLogo(supabase, brand);
    if (!url)
      throw new Error(
        brand.website
          ? "Could not resolve a logo from the website or AI."
          : "Add a website for this brand, then retry — AI logo generation was unavailable.",
      );
    return { ok: true, url };
  });

// ---------- Link products to brands ----------

export const linkProductsToBrands = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");
    const { data: prods } = await supabase
      .from("products")
      .select("id, brand, normalised_brand, brand_id")
      .eq("retailer_id", retailerId)
      .is("brand_id", null);
    const { data: brands } = await supabase
      .from("brands")
      .select("id, name, slug, website, logo_url")
      .eq("retailer_id", retailerId);
    const bySlug = new Map<string, { id: string; website: string | null; logo_url: string | null }>(
      (brands ?? []).map((b: any) => [
        b.slug,
        { id: b.id, website: b.website, logo_url: b.logo_url },
      ]),
    );
    let linked = 0,
      created = 0;
    const newlyCreated: { id: string; name: string; website: string | null }[] = [];
    for (const p of prods ?? []) {
      const raw = (p.normalised_brand ?? p.brand ?? "").toString().trim();
      if (!raw) continue;
      const slug = slugify(raw);
      let entry = bySlug.get(slug);
      if (!entry) {
        const { data: ins } = await supabase
          .from("brands")
          .insert({
            retailer_id: retailerId,
            name: raw,
            slug,
          })
          .select("id")
          .single();
        if (ins) {
          entry = { id: ins.id, website: null, logo_url: null };
          bySlug.set(slug, entry);
          created++;
          newlyCreated.push({ id: ins.id, name: raw, website: null });
        }
      }
      if (entry) {
        await supabase.from("products").update({ brand_id: entry.id }).eq("id", p.id);
        linked++;
      }
    }

    // Auto-fetch logos for any brand missing one (existing + newly created).
    const missingLogo = [
      ...newlyCreated,
      ...(Array.from(bySlug.values())
        .filter((b) => !b.logo_url)
        .map((b) => {
          const row = (brands ?? []).find((x: any) => x.id === b.id);
          return row ? { id: row.id, name: row.name, website: row.website } : null;
        })
        .filter(Boolean) as { id: string; name: string; website: string | null }[]),
    ];
    const seen = new Set<string>();
    let logos = 0;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const b of missingLogo) {
      if (seen.has(b.id)) continue;
      seen.add(b.id);
      const payload = await tryClearbit(b.website);
      if (!payload) continue;
      const path = `${b.id}/logo-${Date.now()}.png`;
      const { error: upErr } = await supabaseAdmin.storage
        .from("brand-logos")
        .upload(path, payload.bytes, {
          contentType: payload.contentType,
          upsert: true,
        });
      if (upErr) continue;
      const { data: pub } = supabaseAdmin.storage.from("brand-logos").getPublicUrl(path);
      await supabase
        .from("brands")
        .update({ logo_path: path, logo_url: pub.publicUrl })
        .eq("id", b.id);
      logos++;
    }
    return { linked, created, logos };
  });

// ---------- Merge brands (admin picks target + sources manually) ----------
export const mergeBrands = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        targetId: z.string().uuid(),
        sourceIds: z.array(z.string().uuid()).min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");
    const sourceIds = data.sourceIds.filter((id) => id !== data.targetId);
    if (sourceIds.length === 0) return { merged: 0 };

    const { error: prodErr } = await supabase
      .from("products")
      .update({ brand_id: data.targetId })
      .in("brand_id", sourceIds)
      .eq("retailer_id", retailerId);
    if (prodErr) throw new Error(prodErr.message);

    const { error: delErr } = await supabase
      .from("brands")
      .delete()
      .in("id", sourceIds)
      .eq("retailer_id", retailerId);
    if (delErr) throw new Error(delErr.message);

    return { merged: sourceIds.length };
  });
