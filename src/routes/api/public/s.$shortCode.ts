import { createFileRoute, redirect } from "@tanstack/react-router";
import { UAParser } from "ua-parser-js";

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const Route = createFileRoute("/api/public/s/$shortCode")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const shortCode = params.shortCode;
        const { data: tag } = await supabaseAdmin
          .from("qr_tags")
          .select("id, product_id, retailer_id, store_id, version, is_active")
          .eq("short_code", shortCode)
          .maybeSingle();

        if (!tag || !tag.is_active) {
          return new Response("This code is no longer active.", { status: 404 });
        }

        const ua = request.headers.get("user-agent") ?? "";
        const parser = new UAParser(ua);
        const device = parser.getDevice().type ?? (/mobile/i.test(ua) ? "mobile" : "desktop");
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          "";
        const ipHash = ip ? (await sha256Hex(ip)).slice(0, 32) : null;
        const referrer = request.headers.get("referer");

        await supabaseAdmin.from("qr_scans").insert({
          qr_tag_id: tag.id,
          product_id: tag.product_id,
          retailer_id: tag.retailer_id,
          store_id: tag.store_id,
          device_type: device,
          user_agent: ua.slice(0, 500),
          ip_hash: ipHash,
          referrer: referrer?.slice(0, 500) ?? null,
          qr_version: tag.version,
        });

        await supabaseAdmin
          .from("qr_tags")
          .update({ scan_count: ((tag as any).scan_count ?? 0) + 1, last_scanned_at: new Date().toISOString() })
          .eq("id", tag.id);

        const url = new URL(request.url);
        throw redirect({
          href: `${url.origin}/scan/${shortCode}`,
        });
      },
    },
  },
});
