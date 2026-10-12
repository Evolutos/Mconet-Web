// Copyright © 2026 Mcont.

import { ModelInteractionError, type InteractionPhase } from "@evolutos/mconet-core-domain";

/** Stable code for an exception that escaped a runtime stage. */
const unknownInteractionFailureCode = "unknown_interaction_failure";

/**
 * Converts an exception that escaped a runtime stage into one interaction error.
 *
 * A {@link ModelInteractionError} is returned unchanged. Any other thrown value
 * becomes an unknown-category error whose message does not copy the thrown text. The
 * original value is retained as `cause` so a caller can inspect it without the
 * public message becoming a secret or a stack dump.
 *
 * @param caught Value thrown by a runtime stage.
 * @param phase Pipeline stage that was running when the value was thrown.
 * @returns The original interaction error, or a new error that retains the cause.
 */
export function captureUnknownInteractionFailure(
  caught: unknown,
  phase: InteractionPhase,
): ModelInteractionError {
  if (caught instanceof ModelInteractionError) {
    return caught;
  }
  return new ModelInteractionError({
    message: "The interaction failed with an unclassified exception.",
    category: "unknown",
    phase,
    code: unknownInteractionFailureCode,
    diagnostics: [
      {
        code: unknownInteractionFailureCode,
        severity: "error",
        phase,
        message: "An unclassified exception was retained as the error cause.",
      },
    ],
    cause: caught,
  });
}
