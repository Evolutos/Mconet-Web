// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { mapWireUsageToDomain } from "./map-token-usage.js";
import { OpenAIChatCompletionUsageDTO } from "./openai-chat-completion-usage-dto.js";

it("copies each reported count and does not replace a mismatched total", () => {
  const usage = mapWireUsageToDomain(
    new OpenAIChatCompletionUsageDTO({
      promptTokens: 1,
      completionTokens: 1,
      totalTokens: 5,
    }),
  );

  expect(usage).toEqual({
    inputTokens: 1,
    outputTokens: 1,
    totalTokens: 5,
    extensions: {},
  });
  expect(Object.isFrozen(usage)).toBe(true);
});

it("keeps an explicit zero and leaves omitted counts absent", () => {
  const usage = mapWireUsageToDomain(new OpenAIChatCompletionUsageDTO({ promptTokens: 0 }));

  expect(usage.inputTokens).toBe(0);
  expect(Object.hasOwn(usage, "outputTokens")).toBe(false);
  expect(Object.hasOwn(usage, "totalTokens")).toBe(false);
  expect(usage.totalTokens).not.toBe(0);
});

it("does not invent a total from the counts that are present", () => {
  const usage = mapWireUsageToDomain(
    new OpenAIChatCompletionUsageDTO({ promptTokens: 2, completionTokens: 3 }),
  );

  expect(Object.hasOwn(usage, "totalTokens")).toBe(false);
});

it("keeps provider breakdowns in extensions", () => {
  const details = { cached_tokens: 4 };
  const usage = mapWireUsageToDomain(
    new OpenAIChatCompletionUsageDTO({
      extensions: { prompt_tokens_details: details },
    }),
  );

  expect(usage).toEqual({ extensions: { prompt_tokens_details: { cached_tokens: 4 } } });
  expect(Object.hasOwn(usage, "inputTokens")).toBe(false);
  expect(Object.hasOwn(usage, "outputTokens")).toBe(false);
  expect(Object.hasOwn(usage, "totalTokens")).toBe(false);
});

it("rejects a usage value that was not parsed", () => {
  const lookalike = { promptTokens: 1, extensions: {} } as unknown as OpenAIChatCompletionUsageDTO;

  expect(() => mapWireUsageToDomain(lookalike)).toThrow(TypeError);
});
