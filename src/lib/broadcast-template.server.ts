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
    }
  | { ok: false; error: string };

const NOT_REGISTERED_MESSAGE =
  `No "${BROADCAST_TEMPLATE_NAME}" template is registered on this WhatsApp sender yet. ` +
  "Broadcasts stay blocked until it appears — older broadcast templates are no longer used.";

/** Statuses WhatsApp considers sendable ("Active – Quality pending" included). */
function isSendableStatus(status: string): boolean {
  const s = status.toUpperCase();
  return s === "APPROVED" || s.startsWith("ACTIVE");
}

export async function resolveBroadcastTemplate(): Promise<BroadcastTemplateResolution> {
  const name = process.env.INFOBIP_TEMPLATE_TAG_BROADCAST_V3 ?? BROADCAST_TEMPLATE_NAME;

  const listed = await listInfobipTemplates();
  if (!listed.ok) {
    return {
      ok: false,
      error: `Could not read the approved WhatsApp templates from the messaging provider (${listed.error}).`,
    };
  }

  const named = listed.templates.filter((t) => t.name === name);
  if (named.length === 0) return { ok: false, error: NOT_REGISTERED_MESSAGE };

  const chosen = named.find((t) => isSendableStatus(t.status));
  if (!chosen) {
    return {
      ok: false,
      error: `Template "${name}" is on the sender but not sendable yet (status: ${named[0]!.status}). Broadcasts unblock once it is approved.`,
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
