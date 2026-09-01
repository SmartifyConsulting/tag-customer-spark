import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role, retailer_id")
      .eq("user_id", userId);
    return { profile: profile ?? null, roles: (roleRows ?? []).map((r: any) => r.role) as string[] };
  });

// JPEG excluded for consistency with the retailer logo uploader — see
// settings.functions.ts's LOGO_MIME comment (no alpha channel support).
const AVATAR_MIME = new Set(["image/png", "image/webp", "image/jpeg"]);
const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const uploadMyAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        filename: z.string().min(1).max(200),
        contentType: z.string().refine((v) => AVATAR_MIME.has(v), "Unsupported image type"),
        base64: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    const b64 = data.base64.includes(",") ? data.base64.split(",")[1] : data.base64;
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 2 * 1024 * 1024) {
      throw new Error("That photo is too large — please choose one under 2 MB.");
    }

    const ext = EXT_BY_MIME[data.contentType] ?? "png";
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("avatars")
      .upload(path, bytes, { contentType: data.contentType, upsert: true });
    if (upErr) throw new Error("Couldn't upload that photo — please try again.");

    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl;

    const { error: updErr } = await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", userId);
    if (updErr) throw new Error("Photo uploaded, but we couldn't save it to your profile — please try again.");

    return { url };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        fullName: z.string().min(1).optional(),
        whatsappE164: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const patch: Record<string, unknown> = {};
    if (data.fullName !== undefined) patch["full_name"] = data.fullName;
    if (data.whatsappE164 !== undefined) patch["whatsapp_e164"] = data.whatsappE164 || null;
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
