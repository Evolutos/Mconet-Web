// Copyright © 2026 Mcont.

import type { CompatibilityPolicy, ProcessingResult } from "@evolutos/mconet-core-domain";

/** Stable code when top-p cannot be sent unchanged. */
const topPOutOfRangeCode = "top_p_out_of_range";

/** Highest nucleus probability this chat-completions protocol accepts. */
const maximumChatTopP = 1;

/** Lowest nucleus probability this protocol accepts. */
const minimumChatTopP = 0;

/**
 * Top-p member to place on a request, or an empty result when it is omitted.
 *
 * `topP` is absent when the caller did not set one. A present number is copied
 * exactly, including zero. Values outside the protocol range are not clamped.
 */
export interface MappedTopP {
  /** Nucleus probability to send, absent when the request should leave the service default. */
  readonly topP?: number;
}

/**
 * Maps one nucleus probability onto the chat-completions `top_p` field.
 *
 * Strict planning fails when the value is outside the protocol range. Compatible
 * and permissive planning omit the member and record a warning. Neither mode
 * rewrites the number.
 *
 * @param topP Caller top-p, or `undefined` when the control was omitted.
 * @param policy Compatibility policy that decides an out-of-range value.
 * @returns The request member, or diagnostics and no value when strict mode rejects it.
 */
export function mapTopPToWire(
  topP: number | undefined,
  policy: CompatibilityPolicy,
): ProcessingResult<MappedTopP> {
  // Omission is not zero. The request leaves the service default in place.
  if (topP === undefined) {
    return { value: Object.freeze({}), diagnostics: [] };
  }
  if (isSendableTopP(topP)) {
    return { value: Object.freeze({ topP }), diagnostics: [] };
  }

  const diagnostic = {
    code: topPOutOfRangeCode,
    severity: policy.mode === "strict" ? ("error" as const) : ("warning" as const),
    phase: "planning" as const,
    message: "Top-p is outside the chat completions range and was not rewritten.",
    path: "topP",
  };
  // Strict mode refuses the request. Other modes omit the member instead of clamping.
  if (policy.mode === "strict") {
    return { diagnostics: [diagnostic] };
  }
  return { value: Object.freeze({}), diagnostics: [diagnostic] };
}

/**
 * Returns whether a top-p value can be written without changing it.
 *
 * @param topP Candidate nucleus probability.
 * @returns Whether it is a finite number in the protocol's inclusive range.
 */
function isSendableTopP(topP: number): boolean {
  return (
    typeof topP === "number" &&
    Number.isFinite(topP) &&
    !Object.is(topP, -0) &&
    topP >= minimumChatTopP &&
    topP <= maximumChatTopP
  );
}
