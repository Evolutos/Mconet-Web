// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { ModelInteractionError, type JsonValue } from "@evolutos/mconet-core-domain";

import { OpenAIChatCompletionResponseDTO } from "./openai-chat-completion-response-dto.js";

const choice: JsonValue = {
  index: 0,
  message: { role: "assistant", content: "Hi" },
  finish_reason: "stop",
};

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
 * Returns the protocol failure message for one decoded response body.
 *
 * @param value Candidate decoded JSON.
 * @returns The failure message.
 */
function failureMessage(value: JsonValue): string {
  const error = capture(() => {
    OpenAIChatCompletionResponseDTO.fromJson(value);
  });
  expect(error).toBeInstanceOf(ModelInteractionError);
  if (!(error instanceof ModelInteractionError)) {
    throw new Error("Expected a model interaction error.");
  }
  expect(error.code).toBe("invalid_protocol_response");
  return error.message;
}

it("reads frozen members and captures the rest", () => {
  const decoded: JsonValue = {
    id: "chatcmpl-1",
    object: "chat.completion",
    created: 1_800_000_000,
    model: "model-a-2026",
    choices: [choice],
    usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
    system_fingerprint: "fp_1",
  };

  const response = OpenAIChatCompletionResponseDTO.fromJson(decoded);
  const firstChoice = response.choices[0];

  expect(response.id).toBe("chatcmpl-1");
  expect(response.model).toBe("model-a-2026");
  expect(firstChoice?.index).toBe(0);
  expect(firstChoice?.message.role).toBe("assistant");
  expect(firstChoice?.message.content).toBe("Hi");
  expect(firstChoice?.finishReason).toBe("stop");
  expect(response.usage?.promptTokens).toBe(3);
  expect(response.usage?.completionTokens).toBe(1);
  expect(response.usage?.totalTokens).toBe(4);
  expect(response.extensions).toEqual({
    object: "chat.completion",
    created: 1_800_000_000,
    system_fingerprint: "fp_1",
  });
  expect(Object.keys(response.extensions)).toEqual(["object", "created", "system_fingerprint"]);
});

it("leaves optional members absent when they were not sent", () => {
  const response = OpenAIChatCompletionResponseDTO.fromJson({ choices: [choice] });

  expect(response.id).toBeUndefined();
  expect(response.model).toBeUndefined();
  expect(response.usage).toBeUndefined();
  expect(Object.hasOwn(response, "id")).toBe(false);
  expect(Object.hasOwn(response, "model")).toBe(false);
  expect(Object.hasOwn(response, "usage")).toBe(false);
  expect(response.extensions).toEqual({});
});

it("keeps empty and multiple choices in service order", () => {
  const second: JsonValue = {
    index: 1,
    message: { role: "assistant", content: "Second" },
    finish_reason: "length",
  };

  const empty = OpenAIChatCompletionResponseDTO.fromJson({ choices: [] });
  const many = OpenAIChatCompletionResponseDTO.fromJson({ choices: [second, choice] });

  expect(empty.choices).toEqual([]);
  expect(many.choices.map((item) => item.index)).toEqual([1, 0]);
});

it("reports nested choice locations", () => {
  expect(
    failureMessage({
      choices: [choice, { index: 1, finish_reason: "stop" }],
    }),
  ).toBe("OpenAI-compatible response field /choices/1/message must be an object.");
});

it("rejects missing or non-array choices", () => {
  const expected = "OpenAI-compatible response field /choices must be an array.";

  expect(failureMessage({})).toBe(expected);
  expect(failureMessage({ choices: null })).toBe(expected);
  expect(failureMessage({ choices: { 0: choice } })).toBe(expected);
});

it("rejects null optional members", () => {
  expect(failureMessage({ id: null, choices: [] })).toBe(
    "OpenAI-compatible response field /id must be a string.",
  );
  expect(failureMessage({ model: 5, choices: [] })).toBe(
    "OpenAI-compatible response field /model must be a string.",
  );
  expect(failureMessage({ usage: null, choices: [] })).toBe(
    "OpenAI-compatible response field /usage must be an object.",
  );
});

it("reports the first invalid member in profile order", () => {
  expect(failureMessage({ usage: null, choices: null, model: 1 })).toBe(
    "OpenAI-compatible response field /model must be a string.",
  );
});

it("rejects a non-object body", () => {
  expect(failureMessage([choice])).toBe("OpenAI-compatible response field / must be an object.");
});

it("requires frozen member types during construction", () => {
  const arrayError = capture(() => {
    new OpenAIChatCompletionResponseDTO({} as never);
  });
  const memberError = capture(() => {
    new OpenAIChatCompletionResponseDTO([choice as never]);
  });
  const idError = capture(() => {
    new OpenAIChatCompletionResponseDTO([], { id: 1 as unknown as string });
  });
  const usageError = capture(() => {
    new OpenAIChatCompletionResponseDTO([], {
      usage: {} as never,
    });
  });

  expect(arrayError).toEqual(
    new TypeError("OpenAIChatCompletionResponseDTO choices must be an array."),
  );
  expect(memberError).toEqual(
    new TypeError(
      "OpenAIChatCompletionResponseDTO choices must contain OpenAIChatCompletionChoiceDTO values.",
    ),
  );
  expect(idError).toEqual(
    new TypeError("OpenAIChatCompletionResponseDTO id must be a string or undefined."),
  );
  expect(usageError).toEqual(
    new TypeError(
      "OpenAIChatCompletionResponseDTO usage must be an OpenAIChatCompletionUsageDTO or undefined.",
    ),
  );
});

it("freezes the response", () => {
  const response = new OpenAIChatCompletionResponseDTO([]);

  expect(Object.isFrozen(response)).toBe(true);
  expect(Object.isFrozen(response.choices)).toBe(true);
  expect(
    capture(() => {
      (response as { model?: string }).model = "other";
    }),
  ).toBeInstanceOf(TypeError);
});
