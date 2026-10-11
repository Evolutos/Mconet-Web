// Copyright © 2026 Mcont.

import { ModelInteractionError, type HeaderFields } from "@evolutos/mconet-core-domain";

import { OpenAIChatCompletionErrorDTO } from "./openai-chat-completion-error-dto.js";

/** HTTP status that means the service refused the call for rate limiting. */
const rateLimitStatus = 429;

/** Stable code for a rate-limited call. */
const rateLimitedCode = "service_rate_limited";

/** Header that may carry a delay in delta-seconds. */
const retryAfterHeader = "retry-after";

/** Milliseconds in one delta-second. */
const millisecondsPerSecond = 1000;

/** Phase of a failure read from a service response. */
const responseParsingPhase = "response_parsing";

/** Fixed technical summary. The service message is never copied into it. */
const rateLimitedMessage = "The service rate limit rejected the call.";

/**
 * Maps an HTTP 429 chat-completions error onto a rate-limit interaction error.
 *
 * Any other status returns `undefined` so authentication and later branches keep
 * their own statuses. The service `message` is not copied. A `Retry-After`
 * value is used only when it is a non-negative delta-second integer; an HTTP
 * date is left unused instead of being converted with a clock.
 *
 * @param input Status, decoded error, headers, and optional request id.
 * @returns The classified error, or `undefined` when the status is not 429.
 */
export function mapRateLimitError(input: {
  readonly statusCode: number | undefined;
  readonly error: OpenAIChatCompletionErrorDTO;
  readonly headers?: HeaderFields;
  readonly requestId?: string;
}): ModelInteractionError | undefined {
  if (!(input.error instanceof OpenAIChatCompletionErrorDTO)) {
    throw new TypeError("Rate-limit mapping requires an OpenAIChatCompletionErrorDTO.");
  }
  if (input.statusCode !== rateLimitStatus) {
    return undefined;
  }

  const retryAfterMilliseconds = retryAfterDelay(input.headers);
  const serviceErrorCode = serviceCodeText(input.error.code);
  return new ModelInteractionError({
    message: rateLimitedMessage,
    category: "rate_limit",
    phase: responseParsingPhase,
    code: rateLimitedCode,
    statusCode: rateLimitStatus,
    // A rate limit is temporary even when the service gave no delay.
    recovery: {
      transient: true,
      ...(retryAfterMilliseconds === undefined ? {} : { retryAfterMilliseconds }),
    },
    diagnostics: [
      {
        code: rateLimitedCode,
        severity: "error",
        phase: responseParsingPhase,
        message: rateLimitedMessage,
      },
    ],
    ...(serviceErrorCode === undefined ? {} : { serviceErrorCode }),
    ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
  });
}

/**
 * Reads the first usable `Retry-After` delta-seconds value.
 *
 * @param headers Response headers in transport order.
 * @returns The delay in milliseconds, or `undefined` when no integer delay exists.
 */
function retryAfterDelay(headers: HeaderFields | undefined): number | undefined {
  if (headers === undefined) {
    return undefined;
  }
  for (const header of headers) {
    if (header.name !== retryAfterHeader) {
      continue;
    }
    const seconds = deltaSeconds(header.value);
    // The first Retry-After occurrence wins. A later duplicate is not consulted.
    return seconds === undefined ? undefined : seconds * millisecondsPerSecond;
  }
  return undefined;
}

/**
 * Parses a delta-seconds header value.
 *
 * @param value Header value exactly as stored.
 * @returns Whole seconds, or `undefined` when the value is not a safe integer delay.
 */
function deltaSeconds(value: string): number | undefined {
  // HTTP allows surrounding whitespace. Trimming does not change the integer.
  const text = value.trim();
  if (!/^\d+$/u.test(text)) {
    return undefined;
  }
  const seconds = Number(text);
  // Reject a delay whose millisecond form would not be an exact safe integer.
  if (!Number.isSafeInteger(seconds) || !Number.isSafeInteger(seconds * millisecondsPerSecond)) {
    return undefined;
  }
  return seconds;
}

/**
 * Returns a service code as text, or `undefined` when the service omitted it.
 *
 * @param code Service code stored on the error object.
 * @returns Text suitable for `serviceErrorCode`.
 */
function serviceCodeText(code: string | number | undefined): string | undefined {
  if (typeof code === "string") {
    return code;
  }
  if (typeof code === "number" && Number.isSafeInteger(code)) {
    return String(code);
  }
  return undefined;
}
