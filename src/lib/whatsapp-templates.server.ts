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
  /**
   * Payload values for the approved template's QUICK_REPLY buttons, in the
   * approved order. WhatsApp requires a parameter for every quick-reply
   * button at send time; omitting them is rejected with error 7008.
   */
  quickReplies?: string[];
  /**
   * A single approved URL button. `dynamicSuffix: true` means the approved
   * button URL ends in a WhatsApp variable (e.g. ".../install/{{1}}") that
   * needs a value supplied per send — set via `urlButtonValue` in
   * buildTemplatePayload's values map, keyed "urlButton". `staticUrl` is
   * the button's full approved URL for a non-dynamic button — Infobip's
   * validation rejects the button entry with a generic "Bad request" if
   * `parameter` is omitted OR empty, so a static button still needs its
   * (unchanging) destination sent as the parameter every time.
   */
  urlButton?: { dynamicSuffix?: boolean; staticUrl?: string };
};

export const TEMPLATE_CONTRACTS: Record<string, TemplateContract> = {
  // Scan confirmation. Approved body has NO variables — the product is
  // identified by the image header only.
  tag_scan_v5: {
    name: "tag_scan_v5",
    language: "en",
    header: "IMAGE",
    placeholders: [],
    // Single approved QUICK_REPLY button. The payload is echoed back on the
    // inbound webhook, which matches on this exact text.
    quickReplies: ["Keep an eye on me"],
  },

  // First attempt at scan confirmation + "install Tag" link — approved
  // with a QUICK_REPLY button (see git history), which meant "Install TAG"
  // never actually opened anything. Kept registered in case a retailer's
  // automation setting still points at it, but tag_scan_confirm_and_install_v2
  // (below) is the real one — a proper Call to Action / Visit Website
  // button — and is now the default.
  tag_scan_confirm_and_install: {
    name: "tag_scan_confirm_and_install",
    language: "en",
    header: "IMAGE",
    placeholders: [],
    quickReplies: ["Install TAG"],
  },

  // v2 — same as above but the button was rebuilt in Infobip as a proper
  // Call to Action → Visit Website button (static URL, not a dynamic
  // suffix) pointing at /install, instead of a mislabeled QUICK_REPLY.
  // Submitted to Meta for approval on 2026-08-20 — will not actually
  // deliver until that clears. Update urlButton.dynamicSuffix to true
  // (and thread a suffix value through) if it turns out the approved
  // button does use a variable suffix after all.
  tag_scan_confirm_and_install_v2: {
    name: "tag_scan_confirm_and_install_v2",
    language: "en",
    header: "IMAGE",
    placeholders: [],
    urlButton: { staticUrl: "https://tag-tech.co.za/install" },
  },

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

  // Marketing broadcast — the "Broadcast" button in Inbox.
  //
  // As registered today, tag_broadcast_v1 is APPROVED in "English (UK)"
  // (en_GB) with an IMAGE header and a FIXED body containing NO variables.
  // Sending it with heading/body placeholders is what caused every broadcast
  // to be permanently rejected with EC_INVALID_TEMPLATE (7009).
  //
  // The registry therefore mirrors reality: zero placeholders. The broadcast
  // send path resolves the actual approved contract live from the provider
  // and requires a template whose body declares two variables:
  //   Category: MARKETING, Header: IMAGE
  //   Body:     "*{{1}}*\n\n{{2}}"   ({{1}} = heading, {{2}} = message body,
  //             with the optional CTA link appended to {{2}} server-side)
  //   Buttons:  none
  // Get that approved (e.g. as tag_broadcast_v2) and broadcasts with custom
  // text start delivering with no code change.
  tag_broadcast_v1: {
    name: "tag_broadcast_v1",
    language: "en_GB",
    header: "IMAGE",
    placeholders: [],
  },

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
  buttons: Array<{ type: "QUICK_REPLY" | "URL"; parameter?: string }>;
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
  /**
   * Overrides the registry contract with one resolved live from the provider's
   * approved-template list. Used by broadcasts, where the approved body's
   * variable count is whatever the retailer got approved.
   */
  contractOverride?: TemplateContract,
): BuiltTemplate | BuildFailure {
  const contract = contractOverride ?? getTemplateContract(templateName);


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

  const buttons: BuiltTemplate["buttons"] = (contract.quickReplies ?? []).map((parameter) => ({
    type: "QUICK_REPLY" as const,
    parameter,
  }));

  if (contract.urlButton) {
    if (contract.urlButton.dynamicSuffix) {
      const suffix = values.urlButton;
      if (suffix == null || suffix === "") {
        return { ok: false, error: `Template "${templateName}" is missing value for its URL button` };
      }
      buttons.push({ type: "URL", parameter: suffix });
    } else {
      // Static URL button. Infobip's API rejects the send with a generic
      // "Bad request" if `parameter` is omitted (confirmed) or empty
      // (also confirmed, on tag_scan_confirm_and_install_v2) — it needs
      // the button's actual destination URL sent as the parameter every
      // time, even though it never changes.
      buttons.push({ type: "URL", parameter: contract.urlButton.staticUrl ?? "" });
    }
  }

  return {
    ok: true,
    templateName: contract.name,
    language: contract.language,
    placeholders,
    headerImageUrl: contract.header === "IMAGE" ? (headerImageUrl as string) : null,
    buttons,
  };
}
