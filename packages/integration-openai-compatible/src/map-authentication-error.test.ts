// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { mapAuthenticationError } from "./map-authentication-error.js";
import { OpenAIChatCompletionErrorDTO } from "./openai-chat-completion-error-dto.js";

const serviceText = "secret-service-text";

function error(body: {
  code?: string | number | null;
  type?: string | null;
}): OpenAIChatCompletionErrorDTO {
  return OpenAIChatCompletionErrorDTO.fromJson({
    message: serviceText,
    type: body.type ?? null,
    code: body.code ?? null,
  });
}

it("maps 401 to authentication and 403 to permission without copying the service message", () => {
  const unauthorized = mapAuthenticationError({
    statusCode: 401,
    error: error({ code: "invalid_api_key", type: "invalid_request_error" }),
    requestId: "req-401",
  });
  const forbidden = mapAuthenticationError({
    statusCode: 403,
    error: error({ code: 1403, type: "permission_error" }),
    requestId: "req-403",
  });

  expect(unauthorized?.category).toBe("authentication");
  expect(unauthorized?.code).toBe("service_authentication_failed");
  expect(unauthorized?.statusCode).toBe(401);
  expect(unauthorized?.serviceErrorCode).toBe("invalid_api_key");
  expect(unauthorized?.requestId).toBe("req-401");
  expect(unauthorized?.message).not.toContain(serviceText);
  expect(JSON.stringify(unauthorized?.diagnostics)).not.toContain(serviceText);

  expect(forbidden?.category).toBe("permission");
  expect(forbidden?.code).toBe("service_permission_denied");
  expect(forbidden?.statusCode).toBe(403);
  expect(forbidden?.serviceErrorCode).toBe("1403");
  expect(forbidden?.requestId).toBe("req-403");
  expect(forbidden?.message).not.toContain(serviceText);
});

it("leaves other statuses for later branches and omits an absent service code", () => {
  expect(
    mapAuthenticationError({
      statusCode: 429,
      error: error({ code: "rate_limit_exceeded" }),
    }),
  ).toBeUndefined();
  const omitted = mapAuthenticationError({
    statusCode: 401,
    error: error({}),
  });
  expect(omitted?.serviceErrorCode).toBeUndefined();
  expect(omitted === undefined || Object.hasOwn(omitted, "serviceErrorCode")).toBe(false);
  expect(omitted === undefined || Object.hasOwn(omitted, "requestId")).toBe(false);
});
