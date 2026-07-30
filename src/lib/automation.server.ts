// Automation Settings repository — resolves a retailer's automation config,
// falling back to the shared defaults for anything never configured.
// Server-only.

import {
  AUTOMATIONS,
  withAutomationDefaults,
  type AutomationKey,
  type AutomationSetting,
} from "@/lib/automation";

export type AutomationSettingsMap = Record<AutomationKey, AutomationSetting>;

export async function getAutomationSettingsList(
  supabase: any,
  retailerId: string,
): Promise<AutomationSetting[]> {
  const { data } = await supabase
    .from("automation_settings")
    .select("automation_key, enabled, threshold, template_name")
    .eq("retailer_id", retailerId);

  const rows = ((data ?? []) as any[]).map((r) => ({
    automation_key: r.automation_key as AutomationKey,
    enabled: Boolean(r.enabled),
    threshold: r.threshold == null ? null : Number(r.threshold),
    template_name: r.template_name as string,
  }));

  return withAutomationDefaults(rows);
}

export async function getAutomationSettingsMap(
  supabase: any,
  retailerId: string,
): Promise<AutomationSettingsMap> {
  const list = await getAutomationSettingsList(supabase, retailerId);
  return Object.fromEntries(list.map((s) => [s.automation_key, s])) as AutomationSettingsMap;
}

/** Persists one automation's configuration for a retailer. */
export async function upsertAutomationSetting(
  supabase: any,
  retailerId: string,
  setting: AutomationSetting,
): Promise<void> {
  const known = AUTOMATIONS.some((a) => a.key === setting.automation_key);
  if (!known) throw new Error(`Unknown automation "${setting.automation_key}"`);

  const { error } = await supabase.from("automation_settings").upsert(
    {
      retailer_id: retailerId,
      automation_key: setting.automation_key,
      enabled: setting.enabled,
      threshold: setting.threshold,
      template_name: setting.template_name,
    },
    { onConflict: "retailer_id,automation_key" },
  );
  if (error) throw new Error(error.message);
}
