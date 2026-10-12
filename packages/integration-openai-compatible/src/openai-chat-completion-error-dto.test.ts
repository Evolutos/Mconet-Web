// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { ModelInteractionError } from "@evolutos/mconet-core-domain";

import { OpenAIChatCompletionErrorDTO } from "./openai-chat-completion-error-dto.js";

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
 * Returns the protocol failure message for one decoded error object.
 *
 * @param value Candidate decoded JSON.
 * @returns The failure message.
 */
function failureMessage(value: unknown): string {
  const error = capture(() => {
    OpenAIChatCompletionErrorDTO.fromJson(value, "/error");
  });
  expect(error).toBeInstanceOf(ModelInteractionError);
  if (!(error instanceof ModelInteractionError)) {
    throw new Error("Expected a model interaction error.");
  }
  expect(error.code).toBe("invalid_protocol_response");
  return error.message;
}

it("reads message, type, and code and captures other members", () => {
  const error = OpenAIChatCompletionErrorDTO.fromJson(
    {
      message: "Rate limit reached.",
      type: "requests",
      code: "rate_limit_exceeded",
      param: null,
    },
    "/error",
  );

  expect(error.message).toBe("Rate limit reached.");
  expect(error.errorType).toBe("requests");
  expect(error.code).toBe("rate_limit_exceeded");
  expect(error.extensions).toEqual({ param: null });
});

it("treats absent and null type and code as omitted", () => {
  const absent = OpenAIChatCompletionErrorDTO.fromJson({ message: "m" });
  const nulled = OpenAIChatCompletionErrorDTO.fromJson({
    message: "m",
    type: null,
    code: null,
  });

  expect(absent.errorType).toBeUndefined();
  expect(absent.code).toBeUndefined();
  expect(nulled.errorType).toBeUndefined();
  expect(nulled.code).toBeUndefined();
  expect(Object.hasOwn(absent, "errorType")).toBe(false);
  expect(Object.hasOwn(nulled, "code")).toBe(false);
});

it("keeps an integer code as a number", () => {
  const error = OpenAIChatCompletionErrorDTO.fromJson({ message: "m", code: 1013 });

  expect(error.code).toBe(1013);
  expect(typeof error.code).toBe("number");
  expect(OpenAIChatCompletionErrorDTO.fromJson({ message: "m", code: -1 }).code).toBe(-1);
});

it("rejects invalid member kinds at their locations", () => {
  expect(failureMessage({ type: "t" })).toBe(
    "OpenAI-compatible response field /error/message must be a string.",
  );
  expect(failureMessage({ message: "m", type: 3 })).toBe(
    "OpenAI-compatible response field /error/type must be a string or null.",
  );
  expect(failureMessage({ message: "m", code: true })).toBe(
    "OpenAI-compatible response field /error/code must be a string, an integer, or null.",
  );
  expect(failureMessage({ message: "m", code: 1.5 })).toBe(
    "OpenAI-compatible response field /error/code must be a string, an integer, or null.",
  );
});

it("rejects a non-object error", () => {
  expect(failureMessage("boom")).toBe("OpenAI-compatible response field /error must be an object.");
});

it("requires frozen member types during construction", () => {
  const messageError = capture(() => {
    new OpenAIChatCompletionErrorDTO(null as unknown as string);
  });
  const typeError = capture(() => {
    new OpenAIChatCompletionErrorDTO("m", { errorType: 1 as unknown as string });
  });
  const booleanError = capture(() => {
    new OpenAIChatCompletionErrorDTO("m", { code: true as unknown as number });
  });
  const unsafeError = capture(() => {
    new OpenAIChatCompletionErrorDTO("m", { code: 2 ** 53 });
  });
  const unsafeReadError = capture(() => {
    OpenAIChatCompletionErrorDTO.fromJson({ message: "m", code: 2 ** 53 });
  });

  expect(messageError).toEqual(
    new TypeError("OpenAIChatCompletionErrorDTO message must be a string."),
  );
  expect(typeError).toEqual(
    new TypeError("OpenAIChatCompletionErrorDTO errorType must be a string or undefined."),
  );
  expect(booleanError).toEqual(
    new TypeError("OpenAIChatCompletionErrorDTO code must be a string, an integer, or undefined."),
  );
  expect(unsafeError).toEqual(
    new RangeError("JSON integer must be within the interoperable safe range."),
  );
  expect(unsafeReadError).toEqual(
    new RangeError("JSON integer must be within the interoperable safe range."),
  );
});

it("freezes the error", () => {
  const error = new OpenAIChatCompletionErrorDTO("m");

  expect(Object.isFrozen(error)).toBe(true);
  expect(
    capture(() => {
      (error as { code?: string }).code = "x";
    }),
  ).toBeInstanceOf(TypeError);
});

it("does not copy the service message into a protocol failure", () => {
  const secret = "TEST_ONLY_DO_NOT_USE";
  const message = failureMessage({ message: [secret] });

  expect(message).not.toContain(secret);
});
