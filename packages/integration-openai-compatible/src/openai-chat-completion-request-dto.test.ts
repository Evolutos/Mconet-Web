// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { OpenAIChatCompletionRequestDTO } from "./openai-chat-completion-request-dto.js";
import { OpenAIChatMessageDTO } from "./openai-chat-message-dto.js";

const messages = Object.freeze([
  new OpenAIChatMessageDTO("system", "Be exact."),
  new OpenAIChatMessageDTO("user", "Hello"),
]);

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
 * Constructs a request from runtime values that bypass the typed signature.
 *
 * @param model Candidate model name.
 * @param requestMessages Candidate message list.
 * @param options Candidate optional members.
 * @returns The constructed request when the values are accepted.
 */
function createRequest(
  model: unknown,
  requestMessages: unknown,
  options?: unknown,
): OpenAIChatCompletionRequestDTO {
  const Request = OpenAIChatCompletionRequestDTO as unknown as new (
    model: unknown,
    requestMessages: unknown,
    options?: unknown,
  ) => OpenAIChatCompletionRequestDTO;
  return new Request(model, requestMessages, options);
}

it("sends stream false and omits optional members that were not supplied", () => {
  const request = new OpenAIChatCompletionRequestDTO("model-a", messages);

  expect(request.toJson()).toEqual({
    model: "model-a",
    messages: [
      { role: "system", content: "Be exact." },
      { role: "user", content: "Hello" },
    ],
    stream: false,
  });
  expect(request.stream).toBe(false);
  expect(Object.keys(request.toJson())).toEqual(["model", "messages", "stream"]);
});

it("writes every supplied member in frozen profile order", () => {
  const request = new OpenAIChatCompletionRequestDTO("model-a", messages, {
    temperature: 0.25,
    topP: 1,
    maxTokens: 512,
    stop: ["<END>", "停止"],
    seed: 0,
  });

  const encoded = request.toJson();

  expect(Object.keys(encoded)).toEqual([
    "model",
    "messages",
    "temperature",
    "top_p",
    "max_tokens",
    "stop",
    "seed",
    "stream",
  ]);
  expect(encoded.temperature).toBe(0.25);
  expect(encoded.top_p).toBe(1);
  expect(encoded.max_tokens).toBe(512);
  expect(encoded.stop).toEqual(["<END>", "停止"]);
  expect(encoded.seed).toBe(0);
});

it("sends zero values instead of treating them as omitted", () => {
  const encoded = new OpenAIChatCompletionRequestDTO("model-a", messages, {
    temperature: 0,
    topP: 0,
    maxTokens: 0,
    seed: 0,
  }).toJson();

  expect(encoded.temperature).toBe(0);
  expect(encoded.top_p).toBe(0);
  expect(encoded.max_tokens).toBe(0);
  expect(encoded.seed).toBe(0);
  expect(Object.hasOwn(encoded, "temperature")).toBe(true);
  expect(Object.hasOwn(encoded, "stop")).toBe(false);
});

it("returns a fresh object on each call", () => {
  const request = new OpenAIChatCompletionRequestDTO("model-a", messages, {
    stop: ["x"],
  });

  const first = request.toJson();
  first.model = "changed";
  const stop = first.stop;
  if (Array.isArray(stop)) {
    stop.push("y");
  }
  const second = request.toJson();

  expect(second.model).toBe("model-a");
  expect(second.stop).toEqual(["x"]);
  expect(request.model).toBe("model-a");
});

it("keeps a copy of the caller message and stop lists", () => {
  const sourceMessages = [
    new OpenAIChatMessageDTO("system", "Be exact."),
    new OpenAIChatMessageDTO("user", "Hello"),
  ];
  const sourceStop = ["x"];
  const request = new OpenAIChatCompletionRequestDTO("model-a", sourceMessages, {
    stop: sourceStop,
  });
  sourceMessages.pop();
  sourceStop.push("y");

  expect(request.messages).toHaveLength(2);
  expect(request.toJson().stop).toEqual(["x"]);
});

it("requires a model string and a non-empty message array", () => {
  const modelError = capture(() => {
    createRequest(null, messages);
  });
  const arrayError = capture(() => {
    createRequest("model-a", messages[0]);
  });
  const emptyError = capture(() => {
    createRequest("model-a", []);
  });
  const memberError = capture(() => {
    createRequest("model-a", [{ role: "user", content: "Hello" }]);
  });
  const optionsError = capture(() => {
    createRequest("model-a", messages, null);
  });

  expect(modelError).toEqual(
    new TypeError("OpenAIChatCompletionRequestDTO model must be a string."),
  );
  expect(arrayError).toEqual(
    new TypeError("OpenAIChatCompletionRequestDTO messages must be an array."),
  );
  expect(emptyError).toEqual(
    new RangeError("OpenAIChatCompletionRequestDTO messages must not be empty."),
  );
  expect(memberError).toEqual(
    new TypeError(
      "OpenAIChatCompletionRequestDTO messages must contain OpenAIChatMessageDTO values.",
    ),
  );
  expect(optionsError).toEqual(
    new TypeError("OpenAIChatCompletionRequestDTO options must be an object."),
  );
});

it("rejects booleans and the wrong numeric kinds", () => {
  const temperatureError = capture(() => {
    createRequest("model-a", messages, { temperature: true });
  });
  const topPError = capture(() => {
    createRequest("model-a", messages, { topP: "0.9" });
  });
  const maxTokensError = capture(() => {
    createRequest("model-a", messages, { maxTokens: 1.5 });
  });
  const seedError = capture(() => {
    createRequest("model-a", messages, { seed: false });
  });

  expect(temperatureError).toEqual(
    new TypeError("OpenAIChatCompletionRequestDTO temperature must be a number or undefined."),
  );
  expect(topPError).toEqual(
    new TypeError("OpenAIChatCompletionRequestDTO topP must be a number or undefined."),
  );
  expect(maxTokensError).toEqual(
    new TypeError("OpenAIChatCompletionRequestDTO maxTokens must be an integer or undefined."),
  );
  expect(seedError).toEqual(
    new TypeError("OpenAIChatCompletionRequestDTO seed must be an integer or undefined."),
  );
});

it("rejects numbers without a portable JSON encoding", () => {
  const temperatureError = capture(() => {
    createRequest("model-a", messages, { temperature: Number.POSITIVE_INFINITY });
  });
  const topPError = capture(() => {
    createRequest("model-a", messages, { topP: Number.NaN });
  });
  const maxTokensError = capture(() => {
    createRequest("model-a", messages, { maxTokens: 2 ** 53 });
  });
  const seedError = capture(() => {
    createRequest("model-a", messages, { seed: -(2 ** 53) });
  });
  const negativeZeroError = capture(() => {
    createRequest("model-a", messages, { temperature: -0 });
  });

  expect(temperatureError).toEqual(new RangeError("JSON floating-point value must be finite."));
  expect(topPError).toEqual(new RangeError("JSON floating-point value must be finite."));
  expect(maxTokensError).toEqual(
    new RangeError("JSON integer must be within the interoperable safe range."),
  );
  expect(seedError).toEqual(
    new RangeError("JSON integer must be within the interoperable safe range."),
  );
  expect(negativeZeroError).toEqual(new RangeError("JSON number must not be negative zero."));
});

it("requires stop to be a non-empty string array or omitted", () => {
  const emptyError = capture(() => {
    createRequest("model-a", messages, { stop: [] });
  });
  const arrayError = capture(() => {
    createRequest("model-a", messages, { stop: "x" });
  });
  const memberError = capture(() => {
    createRequest("model-a", messages, { stop: ["x", 1] });
  });

  expect(emptyError).toEqual(
    new RangeError(
      "OpenAIChatCompletionRequestDTO stop must not be empty; use undefined to omit it.",
    ),
  );
  expect(arrayError).toEqual(
    new TypeError("OpenAIChatCompletionRequestDTO stop must be an array or undefined."),
  );
  expect(memberError).toEqual(
    new TypeError("OpenAIChatCompletionRequestDTO stop must contain only strings."),
  );
});

it("freezes the request", () => {
  const request = new OpenAIChatCompletionRequestDTO("model-a", messages);

  expect(Object.isFrozen(request)).toBe(true);
  expect(Object.isFrozen(request.messages)).toBe(true);
  expect(
    capture(() => {
      (request as { model: string }).model = "model-b";
    }),
  ).toBeInstanceOf(TypeError);
  expect(request.stream).toBe(false);
});
