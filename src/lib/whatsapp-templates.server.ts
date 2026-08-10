// Approved WhatsApp template contracts — the single source of truth for how
// each tag_* template must be addressed.
//
// These contracts mirror the definitions approved on the registered sender.
// Sending a placeholder count or header type that differs from the approved
// definition is accepted by the API but later rejected by WhatsApp with
// "Failed to match template parameters" (error code 7008), so every send is
// built from this registry instead of ad-hoc numbered variables.

export type TemplateContract = {
  /** Registered template name. */
  name: string;
  /** Approved language code. */
  language: string;
  /** Approved header format. All tag_* templates use an IMAGE header. */
  header: "IMAGE" | "NONE";
  /**
   * Named body placeholders in the exact order the approved template expects.
   * An empty array means the approved body has NO variables.
   */
  placeholders: string[];
};

export const TEMPLATE_CONTRACTS: Record<string, TemplateContract> = {
  // Scan confirmation. Approved body has NO variables — the product is
  // identified by the image header only.
  tag_scan_v5: { name: "tag_scan_v5", language: "en", header: "IMAGE", placeholders: [] },

  // Price drop: "My price has dropped from {{1}} to {{2}}".
  tag_valuechange: {
    name: "tag_valuechange",
    language: "en",
    header: "IMAGE",
    placeholders: ["oldPrice", "newPrice"],
  },

  // Someone else showed interest. Approved body has NO variables.
  tag_interest: { name: "tag_interest", language: "en", header: "IMAGE", placeholders: [] },

  // Last unit remaining. Approved body has NO variables.
  tag_lastunit: { name: "tag_lastunit", language: "en", header: "IMAGE", placeholders: [] },
};

/** Templates a watcher may receive after opting in. */
export const ALERT_TEMPLATES = ["tag_valuechange", "tag_interest", "tag_lastunit"] as const;

/**
 * Returns the approved contract for a template. Templates approved after this
 * registry was written fall back to the shape every TAG template shares —
 * IMAGE header, no body variables — so a newly approved name can be selected
 * in Settings without a code change.
 */
export function getTemplateContract(name: string): TemplateContract {
  return (
    TEMPLATE_CONTRACTS[name] ?? { name, language: "en", header: "IMAGE", placeholders: [] }
  );
}

/** WhatsApp media headers require a publicly reachable https URL. */
export function isPublicMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (/^(localhost|127\.|0\.0\.0\.0)/i.test(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export type BuiltTemplate = {
  ok: true;
  templateName: string;
  language: string;
  placeholders: string[];
  headerImageUrl: string | null;
};

export type BuildFailure = { ok: false; error: string };

/**
 * Builds a provider-ready payload for an approved template, or explains
 * exactly why it cannot be sent. Never guesses: a missing required value is a
 * hard failure, because a mismatched send is silently rejected downstream.
 */
export function buildTemplatePayload(
  templateName: string,
  values: Record<string, string | undefined>,
  headerImageUrl: string | null | undefined,
): BuiltTemplate | BuildFailure {
  const contract = getTemplateContract(templateName);

  const placeholders: string[] = [];
  for (const key of contract.placeholders) {
    const value = values[key];
    if (value == null || value === "") {
      return { ok: false, error: `Template "${templateName}" is missing value for "${key}"` };
    }
    placeholders.push(value);
  }

  if (contract.header === "IMAGE" && !isPublicMediaUrl(headerImageUrl)) {
    return {
      ok: false,
      error: `Template "${templateName}" requires a public https image header (got: ${headerImageUrl ?? "none"})`,
    };
  }

  return {
    ok: true,
    templateName: contract.name,
    language: contract.language,
    placeholders,
    headerImageUrl: contract.header === "IMAGE" ? (headerImageUrl as string) : null,
  };
}
