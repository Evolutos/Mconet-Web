// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { mapGenericServiceError } from "./map-generic-service-error.js";
import { OpenAIChatCompletionErrorDTO } from "./openai-chat-completion-error-dto.js";

const serviceText = "secret-upstream-text";

function error(code: string | null = "internal_error"): OpenAIChatCompletionErrorDTO {
  return OpenAIChatCompletionErrorDTO.fromJson({
    message: serviceText,
    type: "server_error",
    code,
  });
}

it("maps 5xx and an unknown status without copying the service message", () => {
  const server = mapGenericServiceError({
    statusCode: 503,
    error: error(),
    requestId: "req-503",
  });
  const unknown = mapGenericServiceError({
    error: error(null),
  });

  expect(server?.category).toBe("model_service");
  expect(server?.code).toBe("service_error");
  expect(server?.statusCode).toBe(503);
  expect(server?.serviceErrorCode).toBe("internal_error");
  expect(server?.requestId).toBe("req-503");
  expect(server?.recovery).toBeUndefined();
  expect(server?.message).not.toContain(serviceText);

  expect(unknown?.category).toBe("unknown");
  expect(unknown?.code).toBe("unrecognized_service_error");
  expect(unknown === undefined || Object.hasOwn(unknown, "statusCode")).toBe(false);
  expect(unknown?.message).not.toContain(serviceText);
});

it("leaves statuses and policy bodies owned by specific branches", () => {
  expect(mapGenericServiceError({ statusCode: 401, error: error() })).toBeUndefined();
  expect(mapGenericServiceError({ statusCode: 429, error: error() })).toBeUndefined();
  expect(
    mapGenericServiceError({
      statusCode: 400,
      error: OpenAIChatCompletionErrorDTO.fromJson({
        message: serviceText,
        type: "invalid_request_error",
        code: "content_filter",
      }),
    }),
  ).toBeUndefined();
});
