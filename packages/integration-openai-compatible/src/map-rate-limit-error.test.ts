// Copyright © 2026 Mcont.

import { expect, it } from "vitest";

import { mapRateLimitError } from "./map-rate-limit-error.js";
import { OpenAIChatCompletionErrorDTO } from "./openai-chat-completion-error-dto.js";

const serviceText = "secret-rate-limit-text";

function error(): OpenAIChatCompletionErrorDTO {
  return OpenAIChatCompletionErrorDTO.fromJson({
    message: serviceText,
    type: "rate_limit_error",
    code: "rate_limit_exceeded",
  });
}

it("maps 429 to a transient rate-limit error and a delta-second delay", () => {
  const mapped = mapRateLimitError({
    statusCode: 429,
    error: error(),
    headers: [
      { name: "content-type", value: "application/json" },
      { name: "retry-after", value: " 2 " },
    ],
    requestId: "req-429",
  });

  expect(mapped?.category).toBe("rate_limit");
  expect(mapped?.code).toBe("service_rate_limited");
  expect(mapped?.statusCode).toBe(429);
  expect(mapped?.serviceErrorCode).toBe("rate_limit_exceeded");
  expect(mapped?.requestId).toBe("req-429");
  expect(mapped?.recovery).toEqual({ transient: true, retryAfterMilliseconds: 2000 });
  expect(mapped?.message).not.toContain(serviceText);
  expect(JSON.stringify(mapped?.diagnostics)).not.toContain(serviceText);
});

it("omits an HTTP-date delay and leaves other statuses unmapped", () => {
  const dated = mapRateLimitError({
    statusCode: 429,
    error: error(),
    headers: [{ name: "retry-after", value: "Wed, 21 Oct 2015 07:28:00 GMT" }],
  });
  expect(dated?.recovery).toEqual({ transient: true });
  expect(dated === undefined || Object.hasOwn(dated.recovery ?? {}, "retryAfterMilliseconds")).toBe(
    false,
  );

  expect(mapRateLimitError({ statusCode: 401, error: error() })).toBeUndefined();
});
