import { createFileRoute } from "@tanstack/react-router";

// Temporary operational probe: proves whether the deployed worker runtime can
// authenticate against Infobip at all, independent of any template or
// recipient. Protected by the existing CRON_SECRET shared secret; it returns
// only non-secret evidence (status codes, key fingerprint, host).
export const Route = createFileRoute("/api/public/hooks/infobip-auth-probe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sharedSecret = process.env.CRON_SECRET ?? process.env.INFOBIP_WEBHOOK_SECRET;
        if (!sharedSecret || request.headers.get("x-cron-secret") !== sharedSecret) {
          return new Response("Unauthorized", { status: 401 });
        }


        const rawKey = process.env.INFOBIP_API_KEY_V2 ?? process.env.INFOBIP_API_KEY ?? "";
        const key = rawKey.trim().replace(/^"|"$/g, "").replace(/^(?:App\s+)+/i, "").trim();
        const rawBase = (process.env.INFOBIP_BASE_URL ?? "").trim().replace(/^"|"$/g, "");
        const base = /^https?:\/\//i.test(rawBase) ? rawBase : `https://${rawBase}`;

        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
        const fingerprint = Array.from(new Uint8Array(digest).slice(0, 8))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        const probe = async (path: string) => {
          try {
            const resp = await fetch(`${base}${path}`, {
              headers: { Authorization: `App ${key}`, Accept: "application/json" },
            });
            const body = (await resp.text()).slice(0, 200);
            return { path, status: resp.status, body };
          } catch (e: any) {
            return { path, status: 0, body: e?.message ?? "network error" };
          }
        };

        return Response.json({
          keyFingerprint: fingerprint,
          keyLength: key.length,
          host: base,
          probes: [await probe("/account/1/balance"), await probe("/whatsapp/2/senders")],
        });
      },
    },
  },
});
