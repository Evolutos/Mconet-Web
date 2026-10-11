// Copyright © 2026 Mcont.

import type { TokenUsage } from "@evolutos/mconet-core-domain";

import { OpenAIChatCompletionUsageDTO } from "./openai-chat-completion-usage-dto.js";

/**
 * Maps reported chat-completion usage onto protocol-neutral token usage.
 *
 * `prompt_tokens` becomes `inputTokens` and `completion_tokens` becomes
 * `outputTokens`. A count that the service omitted stays absent. Zero stays
 * zero. `totalTokens` is copied only when the service reported it and is never
 * computed from the other counts. Extension members stay extensions; they are
 * not promoted into the standard counts.
 *
 * @param usage Parsed usage object.
 * @returns Frozen usage with the same presence and values the service reported.
 * @throws TypeError When `usage` is not an OpenAIChatCompletionUsageDTO.
 */
export function mapWireUsageToDomain(usage: OpenAIChatCompletionUsageDTO): TokenUsage {
  // A lookalike record could invent counts through accessors. Only the parsed
  // usage object has already separated omitted members from explicit zeros.
  if (!(usage instanceof OpenAIChatCompletionUsageDTO)) {
    throw new TypeError("Usage must be an OpenAIChatCompletionUsageDTO.");
  }

  // Start without standard counts so an omitted member is not stored as undefined.
  const mapped: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    extensions: TokenUsage["extensions"];
  } = {
    extensions: usage.extensions,
  };
  if (usage.promptTokens !== undefined) {
    mapped.inputTokens = usage.promptTokens;
  }
  if (usage.completionTokens !== undefined) {
    mapped.outputTokens = usage.completionTokens;
  }
  // The reported total is a separate fact. Do not add the other counts into it.
  if (usage.totalTokens !== undefined) {
    mapped.totalTokens = usage.totalTokens;
  }
  return Object.freeze(mapped);
}
