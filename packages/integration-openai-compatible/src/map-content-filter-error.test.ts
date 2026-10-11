// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { mapContentFilterError } from "./map-content-filter-error.js";
import { OpenAIChatCompletionErrorDTO } from "./openai-chat-completion-error-dto.js";

const serviceText = "secret-policy-text mentions content_filter";

it("maps a content-policy code without copying the service message", () => {
  const mapped = mapContentFilterError({
    statusCode: 400,
    error: OpenAIChatCompletionErrorDTO.fromJson({
      message: serviceText,
      type: "invalid_request_error",
      code: "content_policy_violation",
    }),
    requestId: "req-policy",
  });

  expect(mapped?.category).toBe("content_filter");
  expect(mapped?.code).toBe("service_content_filtered");
  expect(mapped?.statusCode).toBe(400);
  expect(mapped?.serviceErrorCode).toBe("content_policy_violation");
  expect(mapped?.requestId).toBe("req-policy");
  expect(mapped?.message).not.toContain(serviceText);
  expect(mapped?.message).not.toContain("content_filter");
  expect(JSON.stringify(mapped?.diagnostics)).not.toContain(serviceText);
});

it("matches a policy type and ignores a message that only mentions the policy", () => {
  const byType = mapContentFilterError({
    error: OpenAIChatCompletionErrorDTO.fromJson({
      message: serviceText,
      type: "content_filter",
      code: null,
    }),
  });
  expect(byType?.category).toBe("content_filter");
  expect(byType === undefined || Object.hasOwn(byType, "serviceErrorCode")).toBe(false);

  const mentioned = mapContentFilterError({
    error: OpenAIChatCompletionErrorDTO.fromJson({
      message: serviceText,
      type: "invalid_request_error",
      code: "other",
    }),
  });
  expect(mentioned).toBeUndefined();
});
