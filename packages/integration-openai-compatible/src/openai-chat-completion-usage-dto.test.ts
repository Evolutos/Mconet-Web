// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { ModelInteractionError, type JsonValue } from "@evolutos/mconet-core-domain";

import { OpenAIChatCompletionUsageDTO } from "./openai-chat-completion-usage-dto.js";

/**
 * Runs one action and returns the exception it raises.
 *
 * @param action Operation expected to fail.
 * @returns The thrown value.
 */
function capture(action: () => void): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the action to fail.");
}

/**
 * Returns the protocol failure message for one decoded usage object.
 *
 * @param value Candidate decoded JSON.
 * @returns The failure message.
 */
function failureMessage(value: JsonValue): string {
  const error = capture(() => {
    OpenAIChatCompletionUsageDTO.fromJson(value, "/usage");
  });
  expect(error).toBeInstanceOf(ModelInteractionError);
  if (!(error instanceof ModelInteractionError)) {
    throw new Error("Expected a model interaction error.");
  }
  expect(error.code).toBe("invalid_protocol_response");
  return error.message;
}

it("reads all counts and captures breakdowns", () => {
  const decoded: JsonValue = {
    prompt_tokens: 37,
    completion_tokens: 12,
    total_tokens: 49,
    prompt_tokens_details: { cached_tokens: 8 },
  };

  const usage = OpenAIChatCompletionUsageDTO.fromJson(decoded, "/usage");

  expect(usage.promptTokens).toBe(37);
  expect(usage.completionTokens).toBe(12);
  expect(usage.totalTokens).toBe(49);
  expect(usage.extensions).toEqual({ prompt_tokens_details: { cached_tokens: 8 } });
});

it("keeps absent counts absent and keeps an explicit zero", () => {
  const usage = OpenAIChatCompletionUsageDTO.fromJson({ completion_tokens: 0 });

  expect(usage.promptTokens).toBeUndefined();
  expect(usage.completionTokens).toBe(0);
  expect(usage.totalTokens).toBeUndefined();
  expect(Object.hasOwn(usage, "promptTokens")).toBe(false);
  expect(Object.hasOwn(usage, "completionTokens")).toBe(true);
});

it("keeps a reported total instead of computing one", () => {
  const usage = OpenAIChatCompletionUsageDTO.fromJson({
    prompt_tokens: 1,
    completion_tokens: 2,
    total_tokens: 10,
  });

  expect(usage.totalTokens).toBe(10);
});

it("rejects null, negative, boolean, and fractional counts", () => {
  const names = ["prompt_tokens", "completion_tokens", "total_tokens"] as const;
  const values: readonly JsonValue[] = [null, -1, true, 1.5, "1"];
  for (const name of names) {
    for (const value of values) {
      expect(failureMessage({ [name]: value })).toBe(
        `OpenAI-compatible response field /usage/${name} must be a non-negative integer.`,
      );
    }
  }
});

it("rejects a non-object", () => {
  expect(failureMessage(7)).toBe("OpenAI-compatible response field /usage must be an object.");
});

it("requires optional non-negative integers during construction", () => {
  const booleanError = capture(() => {
    new OpenAIChatCompletionUsageDTO({ promptTokens: true as unknown as number });
  });
  const negativeError = capture(() => {
    new OpenAIChatCompletionUsageDTO({ totalTokens: -2 });
  });
  const unsafeError = capture(() => {
    new OpenAIChatCompletionUsageDTO({ completionTokens: 2 ** 53 });
  });

  expect(booleanError).toEqual(
    new TypeError("OpenAIChatCompletionUsageDTO promptTokens must be an integer or undefined."),
  );
  expect(negativeError).toEqual(
    new RangeError("OpenAIChatCompletionUsageDTO totalTokens must not be negative."),
  );
  expect(unsafeError).toEqual(
    new RangeError("JSON integer must be within the interoperable safe range."),
  );
});

it("freezes usage", () => {
  const usage = new OpenAIChatCompletionUsageDTO({
    promptTokens: 1,
    completionTokens: 2,
    totalTokens: 3,
  });

  expect(Object.isFrozen(usage)).toBe(true);
  expect(
    capture(() => {
      (usage as { totalTokens?: number }).totalTokens = 4;
    }),
  ).toBeInstanceOf(TypeError);
});
