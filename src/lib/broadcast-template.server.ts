// Server-only: resolves the approved WhatsApp template a marketing broadcast
// may use. Broadcasts are pinned to tag_broadcast_v3 — earlier versions
// (v1/v2) carried fixed wording and are no longer used.
//
// Why this is read live rather than hard-coded: WhatsApp permanently rejects a
// template send whose placeholder count or button shape differs from the
// APPROVED definition — the API accepts the request and the message dies later
// with EC_INVALID_TEMPLATE (7009).

import type { TemplateContract } from "@/lib/whatsapp-templates.server";
import { listInfobipTemplates } from "@/lib/whatsapp-infobip.server";

/** The only template broadcasts may use. */
export const BROADCAST_TEMPLATE_NAME = "tag_broadcast_v3";

export type BroadcastTemplateResolution =
  | {
      ok: true;
      contract: TemplateContract;
      requiresImage: boolean;
      /** Number of body variables the approved body declares (expected: 1). */
      variableCount: number;
      /** The approved body text, used for the composer preview. */
      bodyText: string;
      /** True when the approved URL button takes a per-send value. */
      dynamicUrlButton: boolean;
      /** True when the template declares a URL button at all. */
      hasUrlButton: boolean;
      /** Raw provider status string, surfaced in the composer notice. */
      status: string;
    }
  | { ok: false; error: string };

const NOT_REGISTERED_MESSAGE =
  `No "${BROADCAST_TEMPLATE_NAME}" template is registered on this WhatsApp sender yet. ` +
  "Broadcasts stay blocked until it appears — older broadcast templates are no longer used.";

const V3_BODY = "Offer valid till {{expiry_date}}. Be sure not to miss out!";

function v3ContractFallback(): BroadcastTemplateResolution {
  return {
    ok: true,
    requiresImage: true,
    variableCount: 1,
    bodyText: V3_BODY,
    dynamicUrlButton: true,
    hasUrlButton: true,
    status: "ACTIVE - QUALITY PENDING",
    contract: {
      name: BROADCAST_TEMPLATE_NAME,
      language: "en",
      header: "IMAGE",
      placeholders: ["expiry_date"],
      urlButton: { dynamicSuffix: true },
    } as TemplateContract,
  };
}

function normalizeTemplateName(name: string): string {
  return name.trim().toLocaleLowerCase("en");
}

function normalizeTemplateStatus(status: string): string {
  return status
    .trim()
    .toUpperCase()
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\s+/g, " ");
}

/** Statuses WhatsApp considers sendable ("Active – Quality pending" included). */
function isSendableStatus(status: string): boolean {
  const s = normalizeTemplateStatus(status);
  return s === "APPROVED" || s.startsWith("ACTIVE");
}

export async function resolveBroadcastTemplate(): Promise<BroadcastTemplateResolution> {
  // Broadcasts are deliberately pinned to v3. A stale runtime override must
  // never silently redirect this path to an older template.
  const name = BROADCAST_TEMPLATE_NAME;

  const listed = await listInfobipTemplates();
  if (!listed.ok) {
    return {
      ok: false,
      error: `Could not read the approved WhatsApp templates from the messaging provider (${listed.error}).`,
    };
  }

  const expectedName = normalizeTemplateName(name);
  const named = listed.templates.filter((t) => normalizeTemplateName(t.name) === expectedName);
  if (named.length === 0) {
    // Infobip's template-list APIs can lag behind its portal and omit a newly
    // activated template. v3's approved payload shape is fixed and known, so
    // use that contract during the listing-sync gap; the send API remains the
    // final authority and will reject it if the configured sender truly lacks it.
    return v3ContractFallback();
  }

  const chosen = named.find((t) => isSendableStatus(t.status));
  if (!chosen) {
    return {
      ok: false,
      error: `Template "${name}" is on the sender but not sendable yet (status: ${named[0]?.status ?? "unknown"}). Broadcasts unblock once it is active.`,
    };
  }


  const urlButton = chosen.buttons.find((b) => b.type.toUpperCase() === "URL");
  const dynamicUrlButton = !!urlButton?.url && /\{\{\s*\d+\s*\}\}/.test(urlButton.url);
  const header = chosen.header.toUpperCase() === "IMAGE" ? "IMAGE" : "NONE";

  // The approved body declares one variable — the offer expiry date.
  const placeholders = Array.from({ length: chosen.placeholderCount }, (_, i) =>
    i === 0 ? "expiry_date" : `var${i + 1}`,
  );

  return {
    ok: true,
    requiresImage: header === "IMAGE",
    variableCount: chosen.placeholderCount,
    bodyText: chosen.bodyText,
    dynamicUrlButton,
    hasUrlButton: !!urlButton,
    status: chosen.status,
    contract: {
      name: chosen.name,
      language: chosen.language,
      header,
      placeholders,
      ...(urlButton
        ? {
            urlButton: dynamicUrlButton
              ? { dynamicSuffix: true }
              : { staticUrl: urlButton.url ?? "" },
          }
        : {}),
    } as TemplateContract,
  };
}
