// Catalogue of the third-party apps TAG integrates with, built from what the
// code actually reads. Client-safe: it names each setting (the server
// environment variable the code reads) but never holds a value.
//
// Values come from two places, and Admin > Integrations can set either:
//   - the server environment (Lovable Cloud › Secrets), or
//   - a value saved from the screen, stored encrypted in the database. A saved
//     value overrides the server secret (see integration-env.server.ts).
// A field marked `secret` is masked in the list and only returned in full
// after the vault password is entered.

export type IntegrationField = {
  /** Name of the server secret / environment variable the code reads. */
  key: string;
  label: string;
  secret: boolean;
  /** Not needed for the integration to work (a default or fallback exists). */
  optional?: boolean;
  help?: string;
  /** Used by the code when nothing is set; shown as the placeholder. */
  defaultValue?: string;
};

export type IntegrationProvider = {
  id: string;
  name: string;
  group: (typeof INTEGRATION_GROUPS)[number];
  summary: string;
  /** Where in TAG this app is actually called — what breaks if it's missing. */
  usedAt: string;
  docsUrl?: string;
  /** Where to top up credit / manage billing for the service, when it has one. */
  billingUrl?: string;
  fields: IntegrationField[];
  /** Apps that need no credentials at all. */
  noKey?: boolean;
  /**
   * Whether values can be entered in the screen. False only for what the app
   * needs in order to reach its own database, which can't be stored in it.
   */
  editable: boolean;
  /** A live "Test connection" is available. */
  testable?: boolean;
};

export const INTEGRATION_GROUPS = [
  "AI",
  "Messaging",
  "Email",
  "Search & data",
  "Payments",
  "Platform",
] as const;

/** Model names used by every AI feature when nothing else is set. */
export const OPENAI_MODEL_DEFAULTS = {
  smart: "gpt-5.5",
  fast: "gpt-5.4-mini",
  vision: "gpt-5-mini",
  image: "gpt-image-2",
} as const;

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    group: "AI",
    summary: "Runs every AI feature in TAG.",
    usedAt:
      "Passport enrichment, product and brand images, category suggestions, name clean-up, import mapping, campaign tools and daily/weekly insights.",
    docsUrl: "https://platform.openai.com/api-keys",
    billingUrl: "https://platform.openai.com/settings/organization/billing/overview",
    editable: true,
    testable: true,
    fields: [
      { key: "OPENAI_API_KEY", label: "API key", secret: true },
      {
        key: "OPENAI_MODEL_SMART",
        label: "Smart model",
        secret: false,
        optional: true,
        defaultValue: OPENAI_MODEL_DEFAULTS.smart,
        help: "For the hardest tasks: passport enrichment, category picks, weekly reports.",
      },
      {
        key: "OPENAI_MODEL_FAST",
        label: "Fast model",
        secret: false,
        optional: true,
        defaultValue: OPENAI_MODEL_DEFAULTS.fast,
        help: "For everyday tasks: name clean-up, import mapping, campaign tools, daily brief.",
      },
      {
        key: "OPENAI_MODEL_VISION",
        label: "Vision model",
        secret: false,
        optional: true,
        defaultValue: OPENAI_MODEL_DEFAULTS.vision,
        help: "Checks that a found photo really shows the product.",
      },
      {
        key: "OPENAI_MODEL_IMAGE",
        label: "Image model",
        secret: false,
        optional: true,
        defaultValue: OPENAI_MODEL_DEFAULTS.image,
        help: "Generates product, brand and category pictures.",
      },
    ],
  },
  {
    id: "infobip",
    name: "Infobip WhatsApp",
    group: "Messaging",
    summary: "Sends WhatsApp templates and receives customer replies.",
    usedAt: "Scan confirmations, price and stock alerts, broadcasts, Inbox replies, delivery reports.",
    docsUrl: "https://portal.infobip.com/channels-and-numbers/channels/whatsapp/senders",
    editable: true,
    testable: true,
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
    editable: true,
    fields: [{ key: "RESEND_API_KEY", label: "API key", secret: true }],
  },
  {
    id: "serper",
    name: "Serper",
    group: "Search & data",
    summary: "Web and image search used to find product information.",
    usedAt: "Product images and passport lookups.",
    docsUrl: "https://serper.dev/api-key",
    editable: true,
    testable: true,
    fields: [{ key: "SERPER_API_KEY", label: "API key", secret: true }],
  },
  {
    id: "open-food-facts",
    name: "Open Food Facts",
    group: "Search & data",
    summary: "Open product database used to look up barcodes.",
    usedAt: "Filling in product details from a GTIN.",
    noKey: true,
    editable: false,
    fields: [],
  },
  {
    id: "payfast",
    name: "PayFast",
    group: "Payments",
    summary: "South African subscription billing.",
    usedAt: "Plan checkout and payment notifications (ITN).",
    docsUrl: "https://www.payfast.co.za/",
    editable: true,
    fields: [
      { key: "PAYFAST_MERCHANT_ID", label: "Merchant ID", secret: false },
      { key: "PAYFAST_MERCHANT_KEY", label: "Merchant key", secret: true },
      { key: "PAYFAST_PASSPHRASE", label: "Passphrase", secret: true, optional: true },
      {
        key: "PAYFAST_ENV",
        label: "Environment",
        secret: false,
        optional: true,
        defaultValue: "sandbox",
        help: "Use \"live\" for real payments; anything else is the sandbox.",
      },
    ],
  },
  {
    id: "paypal",
    name: "PayPal",
    group: "Payments",
    summary: "Card and PayPal billing for international customers.",
    usedAt: "Plan checkout and PayPal webhooks.",
    docsUrl: "https://developer.paypal.com/dashboard/",
    editable: true,
    testable: true,
    fields: [
      { key: "PAYPAL_CLIENT_ID", label: "Client ID", secret: false },
      { key: "PAYPAL_CLIENT_SECRET", label: "Client secret", secret: true },
      { key: "PAYPAL_WEBHOOK_ID", label: "Webhook ID", secret: false, optional: true },
      {
        key: "PAYPAL_ENV",
        label: "Environment",
        secret: false,
        optional: true,
        defaultValue: "sandbox",
        help: "Use \"live\" for real payments; anything else is the sandbox.",
      },
    ],
  },
  {
    id: "lovable-cloud",
    name: "Lovable Cloud (database & auth)",
    group: "Platform",
    summary: "TAG's database, sign-in and file storage.",
    usedAt: "Everything: products, customers, conversations, sign-in and QR files.",
    // The app needs these to reach its database at all, so they can't live in it.
    editable: false,
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
    editable: true,
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

/** Every setting the screen is allowed to override, and nothing else. */
export function editableFieldKeys(): Set<string> {
  return new Set(INTEGRATION_PROVIDERS.filter((p) => p.editable).flatMap((p) => p.fields.map((f) => f.key)));
}
