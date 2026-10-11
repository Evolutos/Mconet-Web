// Copyright © 2026 Mcont.

import type { ProcessingResult } from "@evolutos/mconet-core-domain";

/** Stable code when an output limit cannot be sent unchanged. */
const maxOutputTokensOutOfRangeCode = "max_output_tokens_out_of_range";

/** Smallest output limit this protocol sends. Zero would mean a different request. */
const minimumMaxOutputTokens = 1;

/**
 * Output-token member to place on a request, or an empty result when it is omitted.
 *
 * `maxTokens` is absent when the caller did not set a limit. A present limit is
 * the domain `maxOutputTokens` value copied exactly onto the wire name.
 */
export interface MappedMaxOutputTokens {
  /** Output token limit to send, absent when the request should leave the service default. */
  readonly maxTokens?: number;
}

/**
 * Maps one output token limit onto the chat-completions `max_tokens` field.
 *
 * An omitted limit stays omitted, so it is not sent as zero. A positive safe
 * integer is copied exactly, including `1` and the largest safe integer. Zero,
 * negatives, fractions, and integers that JSON cannot preserve are rejected
 * instead of being rewritten to a nearby limit.
 *
 * @param maxOutputTokens Caller limit, or `undefined` when the control was omitted.
 * @returns The request member, or an error diagnostic and no value.
 */
export function mapMaxOutputTokensToWire(
  maxOutputTokens: number | undefined,
): ProcessingResult<MappedMaxOutputTokens> {
  // Omission is not a zero limit. The request leaves the service default in place.
  if (maxOutputTokens === undefined) {
    return { value: Object.freeze({}), diagnostics: [] };
  }
  if (isSendableMaxOutputTokens(maxOutputTokens)) {
    return { value: Object.freeze({ maxTokens: maxOutputTokens }), diagnostics: [] };
  }

  // The observed number is not copied. A limit can be large, and the failure
  // only needs to say that it was not changed into another limit.
  return {
    diagnostics: [
      {
        code: maxOutputTokensOutOfRangeCode,
        severity: "error",
        phase: "planning",
        message: "Max output tokens is outside the chat completions range and was not rewritten.",
        path: "maxOutputTokens",
      },
    ],
  };
}

/**
 * Returns whether a limit can be written as `max_tokens` without changing it.
 *
 * @param maxOutputTokens Candidate output limit.
 * @returns Whether it is a positive safe integer.
 */
function isSendableMaxOutputTokens(maxOutputTokens: number): boolean {
  return (
    typeof maxOutputTokens === "number" &&
    Number.isSafeInteger(maxOutputTokens) &&
    maxOutputTokens >= minimumMaxOutputTokens
  );
}
