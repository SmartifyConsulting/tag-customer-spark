import { describe, expect, test } from "bun:test";
import { normalizeOpenAiModel } from "./openai-models";

describe("OpenAI model settings", () => {
  test("normalizes GPT-4o mini to its API identifier", () => {
    expect(normalizeOpenAiModel(" GPT-4o mini ", "gpt-4o")).toBe("gpt-4o-mini");
  });
  test("uses gpt-4o-mini for the invalid GPT-6 Astra display label", () => {
    expect(normalizeOpenAiModel("GPT-6 Astra", "gpt-4o-mini")).toBe("gpt-4o-mini");
  });
  test("preserves a canonical API model identifier", () => {
    expect(normalizeOpenAiModel("gpt-4o-2024-08-06", "gpt-4o-mini")).toBe("gpt-4o-2024-08-06");
  });
});