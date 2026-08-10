import { createFileRoute } from "@tanstack/react-router";

// Temporary operational probe: proves whether the deployed worker runtime can
// authenticate against Infobip at all, independent of any template or
// recipient. Protected by the existing CRON_SECRET shared secret; it returns
// only non-secret evidence (status codes, key fingerprint, host).
export const Route = createFileRoute("/api/public/hooks/infobip-auth-probe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sharedSecret =
          process.env.INFOBIP_PROBE_SECRET ??
          process.env.CRON_SECRET ??
          process.env.INFOBIP_WEBHOOK_SECRET;
        if (!sharedSecret || request.headers.get("x-cron-secret") !== sharedSecret) {
          return new Response("Unauthorized", { status: 401 });
        }


        const rawKey = process.env.INFOBIP_API_KEY_V2 ?? "";

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

        // Neutral echo: proves whether the Authorization header leaves this
        // runtime intact, and reports the egress IP Infobip actually sees.
        // Only the header SHAPE is reported — never the key itself.
        let echo: Record<string, unknown> = { ok: false };
        try {
          const resp = await fetch("https://postman-echo.com/get", {
            headers: { Authorization: `App ${key}`, Accept: "application/json" },
          });
          const json: any = await resp.json();
          const seen: string = json?.headers?.authorization ?? "";
          echo = {
            ok: resp.ok,
            status: resp.status,
            egressIp: json?.headers?.["x-forwarded-for"] ?? json?.headers?.["x-real-ip"] ?? null,
            authHeaderPresent: Boolean(seen),
            authHeaderScheme: seen.split(" ")[0] ?? null,
            authHeaderLength: seen.length,
            authHeaderIntact: seen === `App ${key}`,
            headerNames: Object.keys(json?.headers ?? {}).sort(),
          };
        } catch (e: any) {
          echo = { ok: false, error: e?.message ?? "network error" };
        }

        // Egress IP this runtime presents to third parties — what Infobip's
        // network-level restrictions would be matching against.
        try {
          const ipResp = await fetch("https://api.ipify.org?format=json");
          const ipJson: any = await ipResp.json();
          echo["egressIp"] = ipJson?.ip ?? null;
        } catch {
          /* leave egressIp as-is */
        }


        // Optional live send through the real runtime adapter, so the probe can
        // prove end-to-end delivery, not just authentication.
        let send: unknown = null;
        try {
          const body: any = await request.clone().json().catch(() => ({}));
          if (body?.sendTo) {
            const { sendTemplate } = await import("@/lib/whatsapp-service.server");
            send = await sendTemplate({
              to: String(body.sendTo),
              templateName: String(body.template ?? "tag_scan_v5"),
              variables: {},
              headerImageUrl: body.headerImageUrl ? String(body.headerImageUrl) : null,
            });
          }
        } catch (e: any) {
          send = { ok: false, error: e?.message ?? "send failed" };
        }

        return Response.json({
          keyFingerprint: fingerprint,
          keyLength: key.length,
          host: base,
          probes: [await probe("/account/1/balance"), await probe("/whatsapp/2/senders")],
          echo,
          send,
        });

      },
    },
  },
});
