// Server-only: resolves which approved WhatsApp template a marketing
// broadcast may use, from the provider's live template list.
//
// Why this is dynamic rather than a constant: WhatsApp permanently rejects a
// template send whose placeholder count differs from the APPROVED body — the
// API accepts the request and the message dies later with EC_INVALID_TEMPLATE
// (7009), which is exactly how broadcasts were failing silently. The approved
// body is whatever the retailer got approved, so we read it and refuse to send
// unless it can actually carry a heading and a body.

import type { TemplateContract } from "@/lib/whatsapp-templates.server";
import { listInfobipTemplates } from "@/lib/whatsapp-infobip.server";

/** Templates considered for broadcasts, newest naming convention first. */
const BROADCAST_NAME_PREFIX = "tag_broadcast";

export type BroadcastTemplateResolution =
  | { ok: true; contract: TemplateContract; requiresImage: boolean }
  | { ok: false; error: string };

export async function resolveBroadcastTemplate(): Promise<BroadcastTemplateResolution> {
  const override = process.env.INFOBIP_TEMPLATE_TAG_BROADCAST_V1;

  const listed = await listInfobipTemplates();
  if (!listed.ok) {
    return {
      ok: false,
      error: `Could not read the approved WhatsApp templates from the messaging provider (${listed.error}).`,
    };
  }

  const approved = listed.templates.filter(
    (t) =>
      t.status.toUpperCase() === "APPROVED" &&
      (override ? t.name === override : t.name.startsWith(BROADCAST_NAME_PREFIX)),
  );

  if (approved.length === 0) {
    return {
      ok: false,
      error:
        "No approved WhatsApp broadcast template is registered on this sender. Submit a MARKETING template named tag_broadcast_v2 with an IMAGE header and body \"*{{1}}*\\n\\n{{2}}\".",
    };
  }

  // Needs exactly the two variables a broadcast fills: heading and body.
  const usable = approved
    .filter((t) => t.placeholderCount === 2 && t.buttonCount === 0)
    .sort((a, b) => b.name.localeCompare(a.name));

  if (usable.length === 0) {
    const names = approved
      .map((t) => `${t.name} (${t.placeholderCount} variable${t.placeholderCount === 1 ? "" : "s"})`)
      .join(", ");
    return {
      ok: false,
      error:
        `The approved broadcast template can't carry custom text — ${names}. ` +
        "WhatsApp rejects a send whose variable count doesn't match the approved body, which is why earlier broadcasts never arrived. " +
        "Submit a MARKETING template named tag_broadcast_v2, language English (UK), IMAGE header, body \"*{{1}}*\\n\\n{{2}}\" and no buttons, then send again.",
    };
  }

  const chosen = usable[0]!;
  return {
    ok: true,
    requiresImage: chosen.header.toUpperCase() === "IMAGE",
    contract: {
      name: chosen.name,
      language: chosen.language,
      header: chosen.header.toUpperCase() === "IMAGE" ? "IMAGE" : "NONE",
      placeholders: ["heading", "body"],
    } as TemplateContract,
  };
}
