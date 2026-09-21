// Turns a raw AI-gateway failure into a message that says which service,
// which action and (where known) which product, plus what to do next.
// Client-safe: no secrets, no server-only imports.
//
// A described message is one string: "<title>\n<description>". The title ends
// in a full stop so it still reads correctly where a toast shows the plain
// string; splitAiMessage() lets a toast show the two parts separately.

export const AI_SERVICE = "Lovable AI gateway";

export type AiFailureKind = "no_credits" | "rate_limited" | "not_configured" | "other";

function statusOf(e: any): number | undefined {
  const candidates = [
    e?.statusCode,
    e?.status,
    e?.cause?.statusCode,
    e?.lastError?.statusCode,
    e?.response?.status,
  ];
  return candidates.find((c) => typeof c === "number");
}

function textOf(e: any): string {
  return [
    e?.message,
    typeof e?.responseBody === "string" ? e.responseBody : "",
    e?.cause?.message,
    e?.lastError?.message,
    typeof e?.lastError?.responseBody === "string" ? e.lastError.responseBody : "",
  ]
    .filter((s) => typeof s === "string" && s)
    .join(" ");
}

export function classifyAiError(e: unknown): AiFailureKind {
  const status = statusOf(e);
  const text = textOf(e);
  if (status === 402 || /payment required|\b402\b|insufficient (credits|funds|balance)|out of credits|credits? (exhausted|depleted)|usage limit/i.test(text))
    return "no_credits";
  if (status === 429 || /\b429\b|rate.?limit|too many requests/i.test(text)) return "rate_limited";
  if (/LOVABLE_API_KEY.*(not configured|missing)/i.test(text)) return "not_configured";
  return "other";
}

/**
 * @param action  what was being attempted, e.g. `enrich Baby Blue Jumper`
 * @param purpose what the AI service is used for here, e.g. `passport enrichment`
 */
export function describeAiFailure(input: {
  action: string;
  purpose: string;
  error: unknown;
}): { kind: AiFailureKind; message: string } {
  const kind = classifyAiError(input.error);
  const raw = String((input.error as any)?.message ?? input.error ?? "").trim();

  switch (kind) {
    case "no_credits":
      return {
        kind,
        message:
          `Couldn't ${input.action} — the AI service is out of credits.\n` +
          `The ${AI_SERVICE} (used for ${input.purpose}) replied "Payment Required". ` +
          `Your product details weren't changed. Top up AI credits or raise the usage limit in Lovable (Manage limits), then try again.`,
      };
    case "rate_limited":
      return {
        kind,
        message:
          `Couldn't ${input.action} — the AI service is busy.\n` +
          `The ${AI_SERVICE} is limiting requests right now. Wait a minute and try again.`,
      };
    case "not_configured":
      return {
        kind,
        message:
          `Couldn't ${input.action} — AI isn't connected.\n` +
          `The AI key (LOVABLE_API_KEY) is missing on the server. Add it in Lovable Cloud › Secrets.`,
      };
    default:
      return {
        kind,
        message: `Couldn't ${input.action}.\n${raw.slice(0, 300) || "Something went wrong."}`,
      };
  }
}

export function splitAiMessage(message: string): { title: string; description?: string } {
  const i = message.indexOf("\n");
  if (i < 0) return { title: message };
  return {
    title: message.slice(0, i).replace(/\.$/, ""),
    description: message.slice(i + 1).trim() || undefined,
  };
}

export type BulkAiError = {
  productId: string;
  productName?: string | null;
  step?: string;
  message: string;
  aiKind?: AiFailureKind;
};

const MAX_NAMES = 3;

function nameList(names: string[]): string {
  const shown = names.slice(0, MAX_NAMES).join(", ");
  const more = names.length - MAX_NAMES;
  return more > 0 ? `${shown} and ${more} more` : shown;
}

/**
 * One summary for a bulk run instead of a bare "(N issues)".
 * Returns null when there was nothing to report.
 */
export function summarizeBulkErrors(
  errors: BulkAiError[],
  what: string,
): { title: string; description: string } | null {
  if (errors.length === 0) return null;
  const nameOf = (e: BulkAiError) => e.productName || "an unnamed product";
  const uniqueNames = (list: BulkAiError[]) => Array.from(new Set(list.map(nameOf)));

  const noCredits = errors.filter((e) => e.aiKind === "no_credits");
  if (noCredits.length > 0) {
    const names = uniqueNames(noCredits);
    return {
      title: `${names.length} product${names.length === 1 ? "" : "s"} couldn't be ${what} — the AI service is out of credits`,
      description:
        `The ${AI_SERVICE} replied "Payment Required". Affected: ${nameList(names)}. ` +
        `${names.length === 1 ? "Its" : "Their"} product details weren't changed. Top up AI credits or raise the usage limit in Lovable (Manage limits), then run it again.`,
    };
  }
  const rate = errors.filter((e) => e.aiKind === "rate_limited");
  if (rate.length > 0) {
    const names = uniqueNames(rate);
    return {
      title: `${names.length} product${names.length === 1 ? "" : "s"} couldn't be ${what} — the AI service is busy`,
      description: `Affected: ${nameList(names)}. Wait a minute and run it again.`,
    };
  }
  const first = errors[0]!;
  const names = uniqueNames(errors);
  return {
    title: `${names.length} product${names.length === 1 ? "" : "s"} had problems`,
    description:
      `${nameOf(first)}${first.step ? ` (${first.step})` : ""}: ${splitAiMessage(first.message).title}.` +
      (names.length > 1 ? ` Also affected: ${nameList(names.slice(1))}.` : ""),
  };
}
