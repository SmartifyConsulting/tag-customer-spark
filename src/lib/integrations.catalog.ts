// Catalogue of the third-party apps TAG integrates with, built from what the
// code actually reads. Client-safe: it names the server secrets but never
// holds a value. Values are read from the server environment (Lovable Cloud ›
// Secrets) by integrations.functions.ts; a field marked `secret` is masked in
// the list and only returned in full after the vault password is entered.

export type IntegrationField = {
  /** Name of the server secret / environment variable. */
  key: string;
  label: string;
  secret: boolean;
  /** Not needed for the integration to work (a default or fallback exists). */
  optional?: boolean;
  help?: string;
};

export type IntegrationProvider = {
  id: string;
  name: string;
  group: (typeof INTEGRATION_GROUPS)[number];
  summary: string;
  /** Where in TAG this app is actually called — what breaks if it's missing. */
  usedAt: string;
  docsUrl?: string;
  fields: IntegrationField[];
  /** Apps that need no credentials at all. */
  noKey?: boolean;
};

export const INTEGRATION_GROUPS = [
  "Messaging",
  "Email",
  "AI",
  "Search & data",
  "Payments",
  "Platform",
] as const;

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  {
    id: "infobip",
    name: "Infobip WhatsApp",
    group: "Messaging",
    summary: "Sends WhatsApp templates and receives customer replies.",
    usedAt: "Scan confirmations, price and stock alerts, broadcasts, Inbox replies, delivery reports.",
    docsUrl: "https://portal.infobip.com/channels-and-numbers/channels/whatsapp/senders",
    fields: [
      { key: "INFOBIP_API_KEY", label: "API key", secret: true },
      { key: "INFOBIP_BASE_URL", label: "Base URL", secret: false },
      { key: "INFOBIP_WHATSAPP_SENDER", label: "WhatsApp sender number", secret: false },
      {
        key: "INFOBIP_WEBHOOK_SECRET",
        label: "Webhook secret",
        secret: true,
        help: "Must match the secret in the Infobip subscription's webhook URL.",
      },
      { key: "INFOBIP_PROBE_SECRET", label: "Diagnostics probe secret", secret: true, optional: true },
      { key: "INFOBIP_TEMPLATE_LANGUAGE", label: "Template language", secret: false, optional: true },
      { key: "INFOBIP_TEMPLATE_BARCODE_SCAN", label: "Template name: barcode scan", secret: false, optional: true },
      { key: "INFOBIP_TEMPLATE_LAST_ONE", label: "Template name: last one", secret: false, optional: true },
      { key: "INFOBIP_TEMPLATE_HIGH_INTEREST", label: "Template name: high interest", secret: false, optional: true },
      { key: "INFOBIP_TEMPLATE_PRICE_DROP", label: "Template name: price drop", secret: false, optional: true },
    ],
  },
  {
    id: "resend",
    name: "Resend",
    group: "Email",
    summary: "Sends invitation and summary emails.",
    usedAt: "Staff invitations, weekly and daily summary emails.",
    docsUrl: "https://resend.com/api-keys",
    fields: [{ key: "RESEND_API_KEY", label: "API key", secret: true }],
  },
  {
    id: "lovable-ai",
    name: "Lovable AI gateway",
    group: "AI",
    summary: "Runs TAG's AI features through Lovable's gateway.",
    usedAt: "Product passport enrichment, product image generation, taxonomy help, campaign assistant.",
    fields: [{ key: "LOVABLE_API_KEY", label: "API key", secret: true }],
  },
  {
    id: "serper",
    name: "Serper",
    group: "Search & data",
    summary: "Web and image search used to find product information.",
    usedAt: "Product images and passport lookups.",
    docsUrl: "https://serper.dev/api-key",
    fields: [{ key: "SERPER_API_KEY", label: "API key", secret: true }],
  },
  {
    id: "open-food-facts",
    name: "Open Food Facts",
    group: "Search & data",
    summary: "Open product database used to look up barcodes.",
    usedAt: "Filling in product details from a GTIN.",
    noKey: true,
    fields: [],
  },
  {
    id: "payfast",
    name: "PayFast",
    group: "Payments",
    summary: "South African subscription billing.",
    usedAt: "Plan checkout and payment notifications (ITN).",
    docsUrl: "https://www.payfast.co.za/",
    fields: [
      { key: "PAYFAST_MERCHANT_ID", label: "Merchant ID", secret: false },
      { key: "PAYFAST_MERCHANT_KEY", label: "Merchant key", secret: true },
      { key: "PAYFAST_PASSPHRASE", label: "Passphrase", secret: true, optional: true },
      { key: "PAYFAST_ENV", label: "Environment", secret: false, optional: true },
    ],
  },
  {
    id: "paypal",
    name: "PayPal",
    group: "Payments",
    summary: "Card and PayPal billing for international customers.",
    usedAt: "Plan checkout and PayPal webhooks.",
    docsUrl: "https://developer.paypal.com/dashboard/",
    fields: [
      { key: "PAYPAL_CLIENT_ID", label: "Client ID", secret: false },
      { key: "PAYPAL_CLIENT_SECRET", label: "Client secret", secret: true },
      { key: "PAYPAL_WEBHOOK_ID", label: "Webhook ID", secret: false, optional: true },
      { key: "PAYPAL_ENV", label: "Environment", secret: false, optional: true },
    ],
  },
  {
    id: "lovable-cloud",
    name: "Lovable Cloud (database & auth)",
    group: "Platform",
    summary: "TAG's database, sign-in and file storage.",
    usedAt: "Everything: products, customers, conversations, sign-in and QR files.",
    fields: [
      { key: "SUPABASE_URL", label: "Project URL", secret: false },
      { key: "SUPABASE_PUBLISHABLE_KEY", label: "Publishable key", secret: false },
      { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Service-role key", secret: true },
    ],
  },
  {
    id: "scheduled-jobs",
    name: "Scheduled jobs",
    group: "Platform",
    summary: "Protects TAG's background job endpoints.",
    usedAt: "Notification ticks, daily summaries and passport enrichment runs.",
    fields: [
      { key: "CRON_SECRET", label: "Cron secret", secret: true },
      { key: "PUBLIC_SITE_URL", label: "Public site URL", secret: false, optional: true },
      { key: "SITE_URL", label: "Site URL (email links)", secret: false, optional: true },
    ],
  },
];

export function providerById(id: string): IntegrationProvider | undefined {
  return INTEGRATION_PROVIDERS.find((p) => p.id === id);
}
