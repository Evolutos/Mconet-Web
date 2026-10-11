// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { ModelInteractionError, type JsonValue } from "@evolutos/mconet-core-domain";

import { OpenAIChatCompletionChoiceDTO } from "./openai-chat-completion-choice-dto.js";
import { OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";

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
 * Returns the protocol failure message for one decoded choice.
 *
 * @param value Candidate decoded JSON.
 * @returns The failure message.
 */
function failureMessage(value: JsonValue): string {
  const error = capture(() => {
    OpenAIChatCompletionChoiceDTO.fromJson(value, "/choices/0");
  });
  expect(error).toBeInstanceOf(ModelInteractionError);
  if (!(error instanceof ModelInteractionError)) {
    throw new Error("Expected a model interaction error.");
  }
  expect(error.code).toBe("invalid_protocol_response");
  expect(error.phase).toBe("response_parsing");
  return error.message;
}

/**
 * Constructs a choice from runtime values that bypass the typed signature.
 *
 * @param index Candidate index.
 * @param message Candidate message.
 * @param finishReason Candidate finish reason.
 * @returns The constructed choice when the values are accepted.
 */
function createChoice(
  index: unknown,
  message: unknown,
  finishReason: unknown,
): OpenAIChatCompletionChoiceDTO {
  const Choice = OpenAIChatCompletionChoiceDTO as unknown as new (
    index: unknown,
    message: unknown,
    finishReason: unknown,
  ) => OpenAIChatCompletionChoiceDTO;
  return new Choice(index, message, finishReason);
}

it("reads index, message, finish reason, and unknown members", () => {
  const decoded: JsonValue = {
    index: 0,
    message: { role: "assistant", content: "Hi", refusal: null },
    logprobs: null,
    finish_reason: "stop",
  };

  const choice = OpenAIChatCompletionChoiceDTO.fromJson(decoded, "/choices/0");

  expect(choice.index).toBe(0);
  expect(choice.message.role).toBe("assistant");
  expect(choice.message.content).toBe("Hi");
  expect(choice.message.extensions).toEqual({ refusal: null });
  expect(choice.finishReason).toBe("stop");
  expect(choice.extensions).toEqual({ logprobs: null });
});

it("keeps an unknown finish reason exactly", () => {
  const choice = OpenAIChatCompletionChoiceDTO.fromJson({
    index: 2,
    message: { role: "assistant", content: "" },
    finish_reason: "Vendor_Specific",
  });

  expect(choice.index).toBe(2);
  expect(choice.finishReason).toBe("Vendor_Specific");
  expect(choice.extensions).toEqual({});
});

it("reports the nested message location", () => {
  const message = failureMessage({
    index: 0,
    message: { role: "assistant" },
    finish_reason: "stop",
  });

  expect(message).toBe(
    "OpenAI-compatible response field /choices/0/message/content must be a string.",
  );
});

it("requires a non-negative integer index", () => {
  const expected =
    "OpenAI-compatible response field /choices/0/index must be a non-negative integer.";
  const indexes: readonly JsonValue[] = [null, true, 0.5, -1, "0", 2 ** 53];
  for (const index of indexes) {
    expect(
      failureMessage({
        index,
        message: { role: "assistant", content: "" },
        finish_reason: "stop",
      }),
    ).toBe(expected);
  }
  expect(
    failureMessage({
      message: { role: "assistant", content: "" },
      finish_reason: "stop",
    }),
  ).toBe(expected);
});

it("requires a message object and a finish reason string", () => {
  const missingMessage = failureMessage({ index: 0, finish_reason: "stop" });
  const nullReason = failureMessage({
    index: 0,
    message: { role: "assistant", content: "" },
    finish_reason: null,
  });
  const nonObject = failureMessage([]);

  expect(missingMessage).toBe(
    "OpenAI-compatible response field /choices/0/message must be an object.",
  );
  expect(nullReason).toBe(
    "OpenAI-compatible response field /choices/0/finish_reason must be a string.",
  );
  expect(nonObject).toBe("OpenAI-compatible response field /choices/0 must be an object.");
});

it("requires frozen member types during construction", () => {
  const message = new OpenAIChatMessageDTO("assistant", "");
  const booleanError = capture(() => {
    createChoice(true, message, "stop");
  });
  const negativeError = capture(() => {
    createChoice(-1, message, "stop");
  });
  const messageError = capture(() => {
    createChoice(0, { role: "assistant" }, "stop");
  });
  const reasonError = capture(() => {
    createChoice(0, message, null);
  });
  const unsafeError = capture(() => {
    createChoice(2 ** 53, message, "stop");
  });

  expect(booleanError).toEqual(
    new TypeError("OpenAIChatCompletionChoiceDTO index must be an integer."),
  );
  expect(negativeError).toEqual(
    new RangeError("OpenAIChatCompletionChoiceDTO index must not be negative."),
  );
  expect(messageError).toEqual(
    new TypeError("OpenAIChatCompletionChoiceDTO message must be an OpenAIChatMessageDTO."),
  );
  expect(reasonError).toEqual(
    new TypeError("OpenAIChatCompletionChoiceDTO finishReason must be a string."),
  );
  expect(unsafeError).toEqual(
    new RangeError("JSON integer must be within the interoperable safe range."),
  );
});

it("freezes the choice", () => {
  const choice = new OpenAIChatCompletionChoiceDTO(
    0,
    new OpenAIChatMessageDTO("assistant", ""),
    "stop",
  );

  expect(Object.isFrozen(choice)).toBe(true);
  expect(Object.isFrozen(choice.extensions)).toBe(true);
  expect(
    capture(() => {
      (choice as { finishReason: string }).finishReason = "length";
    }),
  ).toBeInstanceOf(TypeError);
});
