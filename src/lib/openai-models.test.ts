import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { normalizeOpenAiModel } from "./openai-models";

describe("OpenAI model settings", () => {
  test("normalizes GPT-4o mini to its API identifier", () => {
    assert.equal(normalizeOpenAiModel(" GPT-4o mini ", "gpt-4o"), "gpt-4o-mini");
  });
  test("uses gpt-4o-mini for the invalid GPT-6 Astra display label", () => {
    assert.equal(normalizeOpenAiModel("GPT-6 Astra", "gpt-4o-mini"), "gpt-4o-mini");
  });
  test("preserves a canonical API model identifier", () => {
    assert.equal(normalizeOpenAiModel("gpt-4o-2024-08-06", "gpt-4o-mini"), "gpt-4o-2024-08-06");
  });
});