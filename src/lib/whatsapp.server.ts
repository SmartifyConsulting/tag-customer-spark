// Server-only WhatsApp send helper.
//
// Infobip is the only delivery provider. There is no provider switch and no
// fallback: a failed send is reported as a failure rather than silently
// re-routed.
//
// Import ONLY from server code (createServerFn handlers, server routes,
// or other .server.ts modules). The `.server` suffix keeps it out of the
// client bundle.

import { sendInfobipWhatsApp } from "@/lib/whatsapp-infobip.server";
import type { InfobipRuntimeDiagnostic } from "@/lib/whatsapp-infobip.server";

export type WhatsAppProvider = "infobip";

export type SendWhatsAppInput = {
  to: string;           // E.164, e.g. "+27821234567" (with or without whatsapp: prefix)
  // Freeform text send. Required unless a template is given instead — WhatsApp
  // only allows freeform sends within 24h of the customer's last inbound
  // message; anything else needs an approved template.
  body?: string;
  mediaUrl?: string | null;
  // --- Infobip approved-template addressing ---
  templateName?: string;
  templateLanguage?: string;
  placeholders?: string[];
  headerImageUrl?: string | null;
  /** QUICK_REPLY button parameters the approved template declares. */
  buttons?: Array<{ type: "QUICK_REPLY"; parameter: string }>;
};

export type SendWhatsAppResult = {
  ok: boolean;
  status: number;
  sid?: string;
  error?: string;
  diagnostic?: InfobipRuntimeDiagnostic;
};

/** Which delivery provider outbound WhatsApp uses. Always Infobip. */
export function activeWhatsAppProvider(): WhatsAppProvider {
  return "infobip";
}

export async function sendWhatsApp(input: SendWhatsAppInput): Promise<SendWhatsAppResult> {
  return sendInfobipWhatsApp({
    to: input.to,
    body: input.body,
    mediaUrl: input.mediaUrl,
    templateName: input.templateName,
    templateLanguage: input.templateLanguage,
    placeholders: input.placeholders,
    headerImageUrl: input.headerImageUrl,
    buttons: input.buttons,
  });
}
