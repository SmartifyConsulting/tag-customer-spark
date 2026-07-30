// WhatsApp Service — the ONLY module that knows about Twilio.
// It receives a template NAME, a recipient number and variables, resolves the
// approved Twilio Content SID for that template and sends it. It knows nothing
// about watches, prices, stock or business rules.

import { sendWhatsApp, type SendWhatsAppResult } from "@/lib/whatsapp.server";

/**
 * Maps an approved template name to the environment variable holding its
 * Twilio Content SID. Add a new template by adding one line here.
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

export type SendTemplateInput = {
  templateName: string;
  to: string;
  /** Numbered placeholders exactly as defined in the approved template. */
  variables?: Record<string, string>;
  /**
   * Plain-text used only when no Content SID is configured for the template.
   * WhatsApp accepts freeform sends within the 24h customer session window.
   */
  fallbackBody?: string;
};

export async function sendTemplate(input: SendTemplateInput): Promise<SendWhatsAppResult> {
  const contentSid = resolveTemplateSid(input.templateName);

  if (contentSid) {
    return sendWhatsApp({ to: input.to, contentSid, contentVariables: input.variables });
  }

  if (!input.fallbackBody) {
    return {
      ok: false,
      status: 400,
      error: `No Twilio template configured for "${input.templateName}"`,
    };
  }

  console.warn(
    `[whatsapp-service] no Content SID for template "${input.templateName}" — falling back to freeform`,
  );
  return sendWhatsApp({ to: input.to, body: input.fallbackBody });
}
