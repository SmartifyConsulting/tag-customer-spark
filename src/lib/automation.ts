// Shared automation catalogue — client-safe (no server imports).
// The Notification Engine and the Automation Settings UI both read from here,
// so adding a new notification type is a one-line change plus an engine rule.

export type AutomationKey =
  | "scan_confirmation"
  | "price_drop"
  | "low_stock"
  | "last_one"
  | "back_in_stock"
  | "high_interest"
  | "daily_summary";

/** Approved TAG templates that can be used as the scan confirmation. */
export const SCAN_TEMPLATE_OPTIONS = [
  "tag_scan_confirm_and_install",
  // Pending Meta approval as of 2026-08-20 — has the real Visit Website
  // install button, but won't deliver until that clears. Once approved,
  // switch the "Scan confirmation" template to this one (here or directly
  // in Settings/Admin > Automations) to make it the live default.
  "tag_scan_confirm_and_install_v2",
  "tag_scan_v5",
  "tag_interest",
  "tag_lastunit",
  "tag_valuechange",
] as const;

export type AutomationDefinition = {
  key: AutomationKey;
  label: string;
  description: string;
  /** null when the rule has no tunable threshold (e.g. "last one" is always 1). */
  threshold: number | null;
  thresholdLabel?: string;
  thresholdSuffix?: string;
  /** Approved WhatsApp template name registered with Infobip. */
  templateName: string;
};

export const AUTOMATIONS: AutomationDefinition[] = [
  {
    key: "scan_confirmation",
    label: "Scan confirmation",
    description:
      "The WhatsApp sent the moment a customer taps Follow Me after scanning. Switch the template here if the current one is rejected.",
    threshold: null,
    // v2 approved 2026-08-20 — has the real Visit Website install button,
    // replacing v1's mislabeled QUICK_REPLY.
    templateName: "tag_scan_confirm_and_install_v2",
  },
  {
    key: "price_drop",
    label: "Price drop",
    description:
      "Message every watcher when the price falls below what it was when they scanned the product.",
    threshold: null,
    templateName: "tag_valuechange",
  },
  {
    key: "low_stock",
    label: "Low stock",
    description:
      "Message watchers when stock falls below the threshold. Re-arms once stock climbs back above it.",
    threshold: 3,
    thresholdLabel: "Notify when stock drops below",
    thresholdSuffix: "units",
    templateName: "low_stock",
  },
  {
    key: "last_one",
    label: "Last one remaining",
    description: "Message watchers when exactly one unit is left. Sends once until stock increases again.",
    threshold: null,
    templateName: "tag_lastunit",
  },
  {
    key: "back_in_stock",
    label: "Back in stock",
    description: "Message watchers when stock goes from zero to available. Re-arms once it sells out again.",
    threshold: null,
    templateName: "back_in_stock",
  },
  {
    key: "high_interest",
    label: "High interest",
    description:
      "Message watchers when at least this many other customers are also actively interested in the same product. Re-arms when the count drops back below.",
    threshold: 1,
    thresholdLabel: "Notify when at least this many other people are interested",
    templateName: "tag_interest",
  },
  {
    key: "daily_summary",
    label: "Daily manager summary",
    description:
      "One evening WhatsApp digest per retailer: scans, top interest product, price changes, stock movement and notifications sent.",
    threshold: null,
    templateName: "daily_summary",
  },
];

export const AUTOMATION_BY_KEY: Record<AutomationKey, AutomationDefinition> = Object.fromEntries(
  AUTOMATIONS.map((a) => [a.key, a]),
) as Record<AutomationKey, AutomationDefinition>;

/**
 * Every WhatsApp template name Tag knows about — every automation's
 * template plus any template that isn't tied to an automation trigger
 * (currently just the marketing broadcast). Used to populate the "Template
 * to test" suggestions in Settings > Automations' live delivery test, so a
 * super admin can test-send anything, not just the scan-confirmation
 * options. Free text is still accepted — this only fills the datalist.
 */
export const ALL_WHATSAPP_TEMPLATES = Array.from(
  new Set<string>([...SCAN_TEMPLATE_OPTIONS, ...AUTOMATIONS.map((a) => a.templateName), "tag_broadcast_v1"]),
);

export type AutomationSetting = {
  automation_key: AutomationKey;
  enabled: boolean;
  threshold: number | null;
  template_name: string;
};

/** Fills in defaults for any automation the retailer has never configured. */
export function withAutomationDefaults(rows: AutomationSetting[]): AutomationSetting[] {
  return AUTOMATIONS.map((def) => {
    const row = rows.find((r) => r.automation_key === def.key);
    return {
      automation_key: def.key,
      enabled: row?.enabled ?? true,
      threshold: row?.threshold ?? def.threshold,
      template_name: row?.template_name || def.templateName,
    };
  });
}
