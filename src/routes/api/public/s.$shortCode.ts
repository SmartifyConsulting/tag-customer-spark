import { createFileRoute } from "@tanstack/react-router";
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
          .select("id, product_id, retailer_id, store_id, version, is_active, scan_count")
          .eq("short_code", shortCode)
          .maybeSingle();

        if (!tag || !tag.is_active) {
          console.warn("[s.shortCode] not found or inactive", { shortCode });
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

        // Store attribution: ?s=<store_id> from the printed QR
        const url = new URL(request.url);
        const scannedStoreParam = url.searchParams.get("s");
        let storeId: string | null = (tag as any).store_id ?? null;
        let storeName: string | null = null;
        if (scannedStoreParam) {
          const { data: st } = await supabaseAdmin
            .from("stores")
            .select("id, name")
            .eq("id", scannedStoreParam)
            .eq("retailer_id", tag.retailer_id)
            .maybeSingle();
          if (st) {
            storeId = (st as any).id;
            storeName = (st as any).name;
          }
        }
        if (storeId && !storeName) {
          const { data: st } = await supabaseAdmin
            .from("stores")
            .select("name")
            .eq("id", storeId)
            .maybeSingle();
          storeName = (st as any)?.name ?? null;
        }

        const { error: insErr } = await supabaseAdmin.from("qr_scans").insert({
          qr_tag_id: tag.id,
          product_id: tag.product_id,
          retailer_id: tag.retailer_id,
          store_id: storeId,
          store_name: storeName,
          device_type: device,
          user_agent: ua.slice(0, 500),
          ip_hash: ipHash,
          referrer: referrer?.slice(0, 500) ?? null,
          qr_version: tag.version,
        });
        if (insErr) console.warn("[s.shortCode] scan insert failed", insErr.message);

        await supabaseAdmin
          .from("qr_tags")
          .update({ scan_count: ((tag as any).scan_count ?? 0) + 1, last_scanned_at: new Date().toISOString() })
          .eq("id", tag.id);

        const publicBase =
          process.env.PUBLIC_SITE_URL?.replace(/\/$/, "") ||
          new URL(request.url).origin;
        const forward = scannedStoreParam ? `?s=${encodeURIComponent(scannedStoreParam)}` : "";
        return new Response(null, {
          status: 302,
          headers: { Location: `${publicBase}/scan/${shortCode}${forward}` },
        });

      },
    },
  },
});
