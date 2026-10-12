// Copyright © 2026 Mcont.

import type { TransportResponseMetadata } from "@evolutos/mconet-core-spi";
import { expect, it } from "vitest";

import { parseOpenAIChatCompletionError } from "./parse-chat-completion-error.js";

const serviceText = "secret-dispatch-text";

function metadata(
  statusCode: number,
  extra: Partial<TransportResponseMetadata> = {},
): TransportResponseMetadata {
  return {
    outcome: "service_error",
    statusCode,
    headers: [],
    extensions: {},
    ...extra,
  };
}

function body(
  code: string,
  type = "invalid_request_error",
): { error: { message: string; type: string; code: string } } {
  return { error: { message: serviceText, type, code } };
}

it("dispatches 401, 403, and 429 before a policy code", () => {
  const unauthorized = parseOpenAIChatCompletionError({
    payload: { typeId: "json.value", value: body("invalid_api_key") },
    metadata: metadata(401, { requestId: "req-401" }),
  });
  const forbidden = parseOpenAIChatCompletionError({
    payload: { typeId: "protocol.openai.chat-error", value: body("permission") },
    metadata: metadata(403),
  });
  const limited = parseOpenAIChatCompletionError({
    payload: {
      typeId: "json.value",
      value: body("content_filter"),
    },
    metadata: metadata(429, { headers: [{ name: "retry-after", value: "3" }] }),
  });

  expect(unauthorized.category).toBe("authentication");
  expect(unauthorized.requestId).toBe("req-401");
  expect(unauthorized.message).not.toContain(serviceText);
  expect(forbidden.category).toBe("permission");
  expect(limited.category).toBe("rate_limit");
  expect(limited.recovery).toEqual({ transient: true, retryAfterMilliseconds: 3000 });
  expect(limited.message).not.toContain(serviceText);
});

it("dispatches a policy body, a 5xx body, and an unknown body to their branches", () => {
  const policy = parseOpenAIChatCompletionError({
    payload: { typeId: "json.value", value: body("content_policy_violation") },
    metadata: metadata(400),
  });
  const server = parseOpenAIChatCompletionError({
    payload: { typeId: "json.value", value: body("internal_error", "server_error") },
    metadata: metadata(500),
  });
  const ordinary = parseOpenAIChatCompletionError({
    payload: { typeId: "json.value", value: body("invalid_parameter") },
    metadata: metadata(400),
  });

  expect(policy.category).toBe("content_filter");
  expect(server.category).toBe("model_service");
  expect(ordinary.category).toBe("unknown");
  expect(policy.message).not.toContain(serviceText);
  expect(server.message).not.toContain(serviceText);
});

it("rejects a success-shaped body instead of parsing choices", () => {
  const rejected = parseOpenAIChatCompletionError({
    payload: {
      typeId: "protocol.openai.chat-response",
      value: {
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "hello" },
            finish_reason: "stop",
          },
        ],
      },
    },
    metadata: metadata(200, { outcome: "success" }),
  });

  expect(rejected.code).toBe("invalid_error_type");
  expect(rejected.message).not.toContain("hello");
});
