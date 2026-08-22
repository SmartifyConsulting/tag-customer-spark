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
  | {
      ok: true;
      contract: TemplateContract;
      requiresImage: boolean;
      /** 2 = custom heading + body; 0 = approved fixed body text. */
      variableCount: number;
      /** The approved fixed body text, when the template has no variables. */
      fixedBody: string | null;
    }
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
      t.buttonCount === 0 &&
      (override ? t.name === override : t.name.startsWith(BROADCAST_NAME_PREFIX)),
  );

  if (approved.length === 0) {
    return {
      ok: false,
      error:
        "No approved WhatsApp broadcast template is registered on this sender. Submit a MARKETING template named tag_broadcast_v3 with an IMAGE header and body \"*{{1}}*\\n\\n{{2}}\".",
    };
  }

  // Prefer a template that can actually carry a custom heading + body. Fall
  // back to an approved fixed-text template so a broadcast can still go out
  // (image + the approved wording) until a variable template is approved.
  const byName = (a: { name: string }, b: { name: string }) => b.name.localeCompare(a.name);
  const chosen =
    approved.filter((t) => t.placeholderCount === 2).sort(byName)[0] ??
    approved.filter((t) => t.placeholderCount === 0).sort(byName)[0];

  if (!chosen) {
    const names = approved
      .map((t) => `${t.name} (${t.placeholderCount} variable${t.placeholderCount === 1 ? "" : "s"})`)
      .join(", ");
    return {
      ok: false,
      error:
        `The approved broadcast template's variable count can't be satisfied — ${names}. ` +
        "Submit a MARKETING template named tag_broadcast_v3, IMAGE header, body \"*{{1}}*\\n\\n{{2}}\" and no buttons.",
    };
  }

  const variableCount = chosen.placeholderCount === 2 ? 2 : 0;
  return {
    ok: true,
    requiresImage: chosen.header.toUpperCase() === "IMAGE",
    variableCount,
    fixedBody: variableCount === 0 ? (chosen.bodyText ?? null) : null,
    contract: {
      name: chosen.name,
      language: chosen.language,
      header: chosen.header.toUpperCase() === "IMAGE" ? "IMAGE" : "NONE",
      placeholders: variableCount === 2 ? ["heading", "body"] : [],
    } as TemplateContract,
  };
}

