import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function resolveRetailerId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("retailer_id")
    .eq("user_id", userId)
    .not("retailer_id", "is", null)
    .limit(1)
    .maybeSingle();
  return data?.retailer_id ?? null;
}

export const getWorkspaceSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return null;

    const [retailer, roi, subscription] = await Promise.all([
      supabase.from("retailers").select("*").eq("id", retailerId).maybeSingle(),
      supabase.from("roi_settings").select("*").eq("retailer_id", retailerId).maybeSingle(),
      supabase.from("subscriptions").select("*").eq("retailer_id", retailerId).maybeSingle(),
    ]);

    return {
      retailer: retailer.data,
      roi: roi.data,
      subscription: subscription.data,
    };
  });

export const updateRetailerProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        contact_email: z.string().email().optional().nullable(),
        logo_url: z.string().url().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");
    const { error } = await supabase.from("retailers").update(data).eq("id", retailerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveRetailerPosSystem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ posSystem: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");
    // `pos_system` predates the generated Supabase types (added in a fresh
    // migration); cast until `types.ts` is regenerated against the DB.
    const { error } = await supabase.from("retailers").update({ pos_system: data.posSystem } as any).eq("id", retailerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) return [];
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("retailer_id", retailerId)
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

// JPEG excluded deliberately — it has no alpha channel, so a JPEG logo can
// never have a transparent background (a hard requirement for how the logo
// gets displayed and colour-sampled across the app).
const LOGO_MIME = new Set(["image/png", "image/webp", "image/svg+xml"]);
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export const uploadRetailerLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        filename: z.string().min(1).max(200),
        contentType: z.string().refine((v) => LOGO_MIME.has(v), "Unsupported image type"),
        base64: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const retailerId = await resolveRetailerId(supabase, userId);
    if (!retailerId) throw new Error("No retailer");

    // Decode base64 (strip data-url prefix if present)
    const b64 = data.base64.includes(",") ? data.base64.split(",")[1] : data.base64;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 2 * 1024 * 1024) {
      throw new Error("Image too large (max 2 MB)");
    }

    const ext = EXT_BY_MIME[data.contentType] ?? "png";
    const path = `${retailerId}/logo-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("retailer-logos")
      .upload(path, bytes, { contentType: data.contentType, upsert: true });
    if (upErr) throw new Error(upErr.message);

    const { data: pub } = supabase.storage.from("retailer-logos").getPublicUrl(path);
    const url = pub.publicUrl;

    const { error: updErr } = await supabase
      .from("retailers")
      .update({ logo_url: url })
      .eq("id", retailerId);
    if (updErr) throw new Error(updErr.message);

    return { url };
  });
