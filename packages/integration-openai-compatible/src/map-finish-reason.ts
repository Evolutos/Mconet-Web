// Copyright © 2026 Mcont.

import {
  isOpenIdentifier,
  ModelInteractionError,
  type FinishReason,
} from "@evolutos/mconet-core-domain";

/** Stable code for a finish reason that cannot be stored as an open identifier. */
const invalidFinishReasonCode = "invalid_finish_reason";

/**
 * Returns the finish reason exactly as the service reported it.
 *
 * There is no closed vocabulary. `stop`, `length`, and any later spelling stay
 * character-for-character, including case. This mapper does not substitute
 * `unknown` or another reason. A value that is not an open identifier fails
 * instead of being rewritten.
 *
 * @param reason Service `finish_reason` text.
 * @returns The same identifier.
 * @throws ModelInteractionError When `reason` is empty, too long, or contains
 *   characters an open identifier cannot store.
 */
export function mapWireFinishReasonToDomain(reason: string): FinishReason {
  // Open identifiers are the domain's exact-value type. Rejecting an unstorable
  // spelling avoids inventing a replacement such as `unknown` or `stop`.
  if (!isOpenIdentifier(reason)) {
    throw new ModelInteractionError({
      message: "OpenAI-compatible finish reason must be an open identifier.",
      category: "protocol",
      phase: "response_parsing",
      code: invalidFinishReasonCode,
      diagnostics: [],
    });
  }
  return reason;
}
