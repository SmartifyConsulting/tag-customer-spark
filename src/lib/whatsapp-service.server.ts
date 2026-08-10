// WhatsApp Service — the ONLY module that knows about the delivery provider's
// template addressing. It receives a template NAME, a recipient number and
// variables, resolves how Infobip addresses that template and sends it. It
// knows nothing about watches, prices, stock or business rules.

import { sendWhatsApp, type SendWhatsAppResult } from "@/lib/whatsapp.server";
import { buildTemplatePayload } from "@/lib/whatsapp-templates.server";

/**
 * Infobip addresses templates by their registered NAME, so no per-template
 * configuration is needed. An optional override lets a retailer register the
 * template under a different name: INFOBIP_TEMPLATE_<NAME>.
 */
export function resolveInfobipTemplateName(templateName: string): string {
  return process.env[`INFOBIP_TEMPLATE_${templateName.toUpperCase()}`] ?? templateName;
}

export type SendTemplateInput = {
  templateName: string;
  to: string;
  /** Named values for the approved template's placeholders. */
  variables?: Record<string, string>;
  /** Media header for templates that define one. */
  headerImageUrl?: string | null;
  /**
   * Plain-text used only when no approved template can be built.
   * WhatsApp accepts freeform sends within the 24h customer session window.
   */
  fallbackBody?: string;
};

export async function sendTemplate(input: SendTemplateInput): Promise<SendWhatsAppResult> {
  // Build strictly from the approved template contract. A mismatched
  // placeholder count or a missing image header is accepted by the API and
  // then rejected by WhatsApp (code 7008), so fail loudly here instead.
  const built = buildTemplatePayload(
    resolveInfobipTemplateName(input.templateName),
    input.variables ?? {},
    input.headerImageUrl ?? null,
  );

  if (!built.ok) {
    console.error(`[whatsapp-service] ${built.error}`);
    return { ok: false, status: 400, error: built.error };
  }

  // No freeform fallback here: these sends are business-initiated and
  // WhatsApp drops freeform outside the customer's 24h session window.
  return sendWhatsApp({
    to: input.to,
    templateName: built.templateName,
    templateLanguage: process.env.INFOBIP_TEMPLATE_LANGUAGE ?? built.language,
    placeholders: built.placeholders,
    headerImageUrl: built.headerImageUrl,
    buttons: built.buttons,
  });
}

