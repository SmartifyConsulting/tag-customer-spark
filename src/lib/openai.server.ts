// OpenAI access for every AI feature. The key and model names come from the
// server environment, which Admin > Integrations can override (see
// integration-env.server.ts), so nothing here caches them.

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { OPENAI_MODEL_DEFAULTS } from "@/lib/integrations.catalog";

export const OPENAI_BASE = "https://api.openai.com/v1";

export function openAiKey(): string {
  return (process.env.OPENAI_API_KEY ?? "").trim();
}

export function openAiConfigured(): boolean {
  return Boolean(openAiKey());
}

/** Model names, overridable per slot in Admin > Integrations. */
export function openAiModels() {
  const pick = (env: string, fallback: string) => (process.env[env] ?? "").trim() || fallback;
  return {
    /** Hardest tasks: passport enrichment, category picks, weekly reports. */
    smart: pick("OPENAI_MODEL_SMART", OPENAI_MODEL_DEFAULTS.smart),
    /** Everyday text tasks: normalisation, import mapping, campaign tools, daily brief. */
    fast: pick("OPENAI_MODEL_FAST", OPENAI_MODEL_DEFAULTS.fast),
    /** Reading product photos. */
    vision: pick("OPENAI_MODEL_VISION", OPENAI_MODEL_DEFAULTS.vision),
    /** Generating images. */
    image: pick("OPENAI_MODEL_IMAGE", OPENAI_MODEL_DEFAULTS.image),
  };
}

/** Headers for direct REST calls (chat completions, images). */
export function openAiHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${openAiKey()}` };
}

/** Provider for the Vercel AI SDK (generateObject / generateText). */
export function getOpenAiProvider(options?: { structuredOutputs?: boolean }) {
  const apiKey = openAiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  return createOpenAICompatible({
    name: "openai",
    baseURL: OPENAI_BASE,
    apiKey,
    supportsStructuredOutputs: options?.structuredOutputs ?? false,
  });
}
