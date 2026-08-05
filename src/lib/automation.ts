// Shared automation catalogue — client-safe (no server imports).
// The Notification Engine and the Automation Settings UI both read from here,
// so adding a new notification type is a one-line change plus an engine rule.

export type AutomationKey =
  | "price_drop"
  | "low_stock"
  | "last_one"
  | "back_in_stock"
  | "high_interest"
  | "daily_summary";

export type AutomationDefinition = {
  key: AutomationKey;
  label: string;
  description: string;
  /** null when the rule has no tunable threshold (e.g. "last one" is always 1). */
  threshold: number | null;
  thresholdLabel?: string;
  thresholdSuffix?: string;
  /** Approved Twilio Content Template name (not the SID — see whatsapp-service). */
  templateName: string;
};

export const AUTOMATIONS: AutomationDefinition[] = [
  {
    key: "price_drop",
    label: "Price drop",
    description:
      "Message every watcher when the price falls below what it was when they scanned the product.",
    threshold: null,
    templateName: "price_drop",
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
    templateName: "last_one",
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
    templateName: "high_interest",
  },
  {
    key: "daily_summary",
    label: "Daily manager summary",
    description:
      "One evening WhatsApp digest per retailer: scans, top intent product, price changes, stock movement and notifications sent.",
    threshold: null,
    templateName: "daily_summary",
  },
];

export const AUTOMATION_BY_KEY: Record<AutomationKey, AutomationDefinition> = Object.fromEntries(
  AUTOMATIONS.map((a) => [a.key, a]),
) as Record<AutomationKey, AutomationDefinition>;

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
