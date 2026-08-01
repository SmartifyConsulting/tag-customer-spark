// WhatsApp Service — the ONLY module that knows about the delivery provider's
// template addressing. It receives a template NAME, a recipient number and
// variables, resolves how the active provider addresses that template and
// sends it. It knows nothing about watches, prices, stock or business rules.

import {
  activeWhatsAppProvider,
  sendWhatsApp,
  type SendWhatsAppResult,
} from "@/lib/whatsapp.server";

/**
 * Maps an approved template name to the environment variable holding its
 * Twilio Content SID. Only used when the active provider is Twilio.
 */
const TEMPLATE_SID_ENV: Record<string, string> = {
  price_drop: "TWILIO_TEMPLATE_PRICE_DROP_SID",
  low_stock: "TWILIO_TEMPLATE_LOWSTOCK_SID",
  last_one: "TWILIO_TEMPLATE_LAST_ONE_SID",
  back_in_stock: "TWILIO_TEMPLATE_RESTOCK_SID",
  high_interest: "TWILIO_TEMPLATE_HIGH_INTEREST_SID",
  daily_summary: "TWILIO_TEMPLATE_DAILY_SUMMARY_SID",
  // Legacy aliases kept so existing sends keep working.
  sale: "TWILIO_TEMPLATE_SALE_SID",
  barcode_scan: "TWILIO_TEMPLATE_BARCODE_SCAN_SID",
  conversation_starter: "TWILIO_TEMPLATE_CONVERSATION_STARTER_SID",
};

export function resolveTemplateSid(templateName: string): string | undefined {
  const envKey = TEMPLATE_SID_ENV[templateName];
  const direct = envKey ? process.env[envKey] : undefined;
  if (direct) return direct;
  // Convention fallback: TWILIO_TEMPLATE_<NAME>_SID
  return process.env[`TWILIO_TEMPLATE_${templateName.toUpperCase()}_SID`];
}

/**
 * Infobip addresses templates by their registered NAME, so no per-template
 * configuration is needed. An optional override lets a retailer register the
 * template under a different name: INFOBIP_TEMPLATE_<NAME>.
 */
export function resolveInfobipTemplateName(templateName: string): string {
  return process.env[`INFOBIP_TEMPLATE_${templateName.toUpperCase()}`] ?? templateName;
}

/** Turns {"1": "a", "2": "b"} into ["a", "b"] in numeric order. */
function toPlaceholders(variables?: Record<string, string>): string[] {
  if (!variables) return [];
  return Object.keys(variables)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => variables[k] ?? "");
}

export type SendTemplateInput = {
  templateName: string;
  to: string;
  /** Numbered placeholders exactly as defined in the approved template. */
  variables?: Record<string, string>;
  /** Optional media header for templates that define one. */
  headerImageUrl?: string | null;
  /**
   * Plain-text used only when no template is configured for the provider.
   * WhatsApp accepts freeform sends within the 24h customer session window.
   */
  fallbackBody?: string;
};

export async function sendTemplate(input: SendTemplateInput): Promise<SendWhatsAppResult> {
  const provider = activeWhatsAppProvider();

  if (provider === "infobip") {
    // Twilio templates carry the header image as numbered variable "1".
    // Infobip takes it as a separate header, so strip it from placeholders.
    let variables = input.variables;
    if (input.headerImageUrl && variables?.["1"] === input.headerImageUrl) {
      const { "1": _omit, ...rest } = variables;
      variables = rest;
    }
    const result = await sendWhatsApp({
      to: input.to,
      templateName: resolveInfobipTemplateName(input.templateName),
      templateLanguage: process.env.INFOBIP_TEMPLATE_LANGUAGE ?? "en",
      placeholders: toPlaceholders(variables),
      headerImageUrl: input.headerImageUrl ?? null,
    });

    // If the template isn't registered/approved yet, still try to reach the
    // customer inside an open 24h session rather than dropping the message.
    if (!result.ok && input.fallbackBody) {
      console.warn(
        `[whatsapp-service] Infobip template "${input.templateName}" failed (${result.error}) — falling back to freeform`,
      );
      return sendWhatsApp({ to: input.to, body: input.fallbackBody });
    }
    return result;
  }

  const contentSid = resolveTemplateSid(input.templateName);

  if (contentSid) {
    return sendWhatsApp({ to: input.to, contentSid, contentVariables: input.variables });
  }

  if (!input.fallbackBody) {
    return {
      ok: false,
      status: 400,
      error: `No template configured for "${input.templateName}"`,
    };
  }

  console.warn(
    `[whatsapp-service] no Content SID for template "${input.templateName}" — falling back to freeform`,
  );
  return sendWhatsApp({ to: input.to, body: input.fallbackBody });
}
